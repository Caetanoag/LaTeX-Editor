#!/usr/bin/env bash
# fluxo.sh — do registro ao PDF, ponta a ponta
set -euo pipefail

BASE=http://localhost:3000

# -----------------------------------------------------------------------------
# 1. REGISTRO
# -----------------------------------------------------------------------------
echo "→ Registrando usuário..."
REGISTER=$(curl -s -X POST $BASE/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
    "email": "alicee@example.commm",
    "username": "alicee",
    "password": "senha123456890000"
  }')

echo "$REGISTER" | jq .

TOKEN=$(echo "$REGISTER" | jq -r '.session.token')
USER_ID=$(echo "$REGISTER" | jq -r '.user.id')

if [ "$TOKEN" = "null" ]; then
  echo "❌ Registro falhou. Talvez o usuário já exista."
  echo "→ Tentando login..."
  LOGIN=$(curl -s -X POST $BASE/auth/login \
    -H 'Content-Type: application/json' \
    -d '{"email":"alicee@example.commm","password":"senha123456890000"}')
  TOKEN=$(echo "$LOGIN" | jq -r '.session.token')
  USER_ID=$(echo "$LOGIN" | jq -r '.user.id')
fi

echo "✓ Token obtido"
echo "✓ User ID: $USER_ID"

# -----------------------------------------------------------------------------
# 2. CRIAR WORKSPACE
# -----------------------------------------------------------------------------
echo ""
echo "→ Criando workspace..."

WORKSPACE=$(curl -s -X POST $BASE/workspaces \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "name": "Meu Laboratório",
    "description": "Workspace de testes"
  }')

echo "$WORKSPACE" | jq .

WORKSPACE_ID=$(echo "$WORKSPACE" | jq -r '.workspace.id')
echo "✓ Workspace ID: $WORKSPACE_ID"

# -----------------------------------------------------------------------------
# 3. CRIAR PROJETO
# -----------------------------------------------------------------------------
echo ""
echo "→ Criando projeto..."

PROJECT=$(curl -s -X POST $BASE/projects \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{
    \"workspaceId\": $WORKSPACE_ID,
    \"title\": \"Meu Artigo\",
    \"description\": \"Artigo de teste\",
    \"visibility\": \"private\"
  }")

echo "$PROJECT" | jq .

PROJECT_ID=$(echo "$PROJECT" | jq -r '.project.id')
echo "✓ Project ID: $PROJECT_ID"

# -----------------------------------------------------------------------------
# 4. CRIAR ARQUIVO MAIN
# -----------------------------------------------------------------------------
echo ""
echo "→ Criando arquivo /main.tex..."

FILE=$(curl -s -X POST $BASE/projects/$PROJECT_ID/files \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "filePath": "/main.tex",
    "fileContent": "\\documentclass{article}\n\\begin{document}\n\\section{Olá}\nMundo do LaTeX.\n\\end{document}",
    "isMain": true
  }')

echo "$FILE" | jq .

FILE_ID=$(echo "$FILE" | jq -r '.file.id')
echo "✓ File ID: $FILE_ID"

# -----------------------------------------------------------------------------
# 5. PRIMEIRA COMPILAÇÃO
# -----------------------------------------------------------------------------
echo ""
echo "→ Compilando pela primeira vez..."

HTTP_CODE=$(curl -s -o pdf1.pdf -w "%{http_code}" \
  -X POST $BASE/files/$FILE_ID/compile \
  -H "Authorization: Bearer $TOKEN")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ PDF 1 gerado: pdf1.pdf"
  file pdf1.pdf
  ls -lh pdf1.pdf
else
  echo "❌ Compilação falhou (HTTP $HTTP_CODE)"
  cat pdf1.pdf
  exit 1
fi

# -----------------------------------------------------------------------------
# 6. EDITAR ARQUIVO
# -----------------------------------------------------------------------------
echo ""
echo "→ Editando /main.tex..."

UPDATED=$(curl -s -X PUT $BASE/files/$FILE_ID \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "fileContent": "\\documentclass{article}\n\\begin{document}\n\\section{Olá, de novo}\nO conteúdo mudou.\n\\section{Nova seção}\nMais texto aqui.\n\\end{document}"
  }')

echo "$UPDATED" | jq .

# -----------------------------------------------------------------------------
# 7. SEGUNDA COMPILAÇÃO
# -----------------------------------------------------------------------------
echo ""
echo "→ Compilando após edição..."

HTTP_CODE=$(curl -s -o pdf2.pdf -w "%{http_code}" \
  -X POST $BASE/files/$FILE_ID/compile \
  -H "Authorization: Bearer $TOKEN")

if [ "$HTTP_CODE" = "200" ]; then
  echo "✓ PDF 2 gerado: pdf2.pdf"
  file pdf2.pdf
  ls -lh pdf2.pdf
else
  echo "❌ Compilação falhou (HTTP $HTTP_CODE)"
  cat pdf2.pdf
  exit 1
fi

# -----------------------------------------------------------------------------
# 8. RESUMO
# -----------------------------------------------------------------------------
echo ""
echo "============================================================"
echo "Fluxo completo executado com sucesso."
echo "============================================================"
echo "User ID:       $USER_ID"
echo "Workspace ID:  $WORKSPACE_ID"
echo "Project ID:    $PROJECT_ID"
echo "File ID:       $FILE_ID"
echo ""
echo "PDFs gerados:"
echo "  pdf1.pdf  (conteúdo inicial)"
echo "  pdf2.pdf  (após edição)"
echo ""
echo "Compare os dois:"
echo "  file pdf1.pdf pdf2.pdf"
echo "  ls -lh pdf1.pdf pdf2.pdf"
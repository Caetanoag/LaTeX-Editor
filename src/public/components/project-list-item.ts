class ProjectItem extends HTMLElement {
	async connectedCallback() {
		const projectTitle = this.getAttribute("project-title") || "";
		const projectOwner = Number(this.getAttribute("owner") || "");
		const lastModified = this.getAttribute("last-modified") || "";
		const getOwnerString = async (id: number) => {
			if (id <= 0) return "Unknow";
			const session = localStorage.getItem("session");
			if (!session) return "Unknow";
			const token = JSON.parse(session).token;
			try {
				const response = await fetch(`${window.location.origin}/users/${id}`, {
					headers: {
						Authorization: `Bearer ${token}`,
					},
				});
				const data = await response.json();
				return data.username;
			} catch {
				return "Unknow";
			}
		};
		const getRelativeTime = (isoDate: string) => {
			const date = new Date(isoDate).getTime();
			const now = Date.now();

			const seconds = Math.floor((now - date) / 1000);
			const minutes = Math.floor(seconds / 60);
			const hours = Math.floor(minutes / 60);
			const days = Math.floor(hours / 24);
			const years = Math.floor(days / 365.25);
			const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

			if (Math.abs(years) > 0) {
				return rtf.format(-years, "year");
			}
			if (Math.abs(days) > 0) {
				return rtf.format(-days, "day");
			}
			if (Math.abs(hours) > 0) {
				return rtf.format(-hours, "hour");
			}
			if (Math.abs(minutes) > 0) {
				return rtf.format(-minutes, "minute");
			}
			return rtf.format(-seconds, "second");
		};
		this.innerHTML = `
            <tr>
					<td>
						<input
							type="checkbox"
							name="radio-1"
							id="checkbox-1"
							class="table-checkbox"
						>
					</td>
					<td>${projectTitle}</td>
					<td>${await getOwnerString(projectOwner)}</td>
					<td>${getRelativeTime(lastModified)}</td>
				</tr>
        `;
	}
}
customElements.define("project-item", ProjectItem);

class s extends HTMLElement{connectedCallback(){let i=this.getAttribute("project-title")||"",c=this.getAttribute("owner")||"",d=this.getAttribute("last-modified")||"",l=(f)=>{let h=new Date(f).getTime(),m=Date.now(),r=Math.floor((m-h)/1000),e=Math.floor(r/60),o=Math.floor(e/60),n=Math.floor(o/24),a=Math.floor(n/365.25),t=new Intl.RelativeTimeFormat("en",{numeric:"auto"});if(Math.abs(a)>0)return t.format(-a,"year");if(Math.abs(n)>0)return t.format(-n,"day");if(Math.abs(o)>0)return t.format(-o,"hour");if(Math.abs(e)>0)return t.format(-e,"minute");return t.format(-r,"second")};this.innerHTML=`
            <tr>
					<td>
						<input
							type="checkbox"
							name="radio-1"
							id="checkbox-1"
							class="table-checkbox"
						>
					</td>
					<td>${i}</td>
					<td>${c}</td>
					<td>${l(d)}</td>
				</tr>
        `}}customElements.define("project-item",s);

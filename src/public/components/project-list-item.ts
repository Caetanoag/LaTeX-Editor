class ProjectItem extends HTMLElement {
	connectedCallback() {
		const projectTitle = this.getAttribute("project-title") || "";
		const projectOwner = this.getAttribute("owner") || "";
		const lastModified = this.getAttribute("last-modified") || "";

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
					<td>${projectOwner}</td>
					<td>${getRelativeTime(lastModified)}</td>
				</tr>
        `;
	}
}
customElements.define("project-item", ProjectItem);

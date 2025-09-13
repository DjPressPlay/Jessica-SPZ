// ztab-search.js

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("z-start-input");
  const button = document.getElementById("z-search-btn");
  const resultsContainer = document.getElementById("z-search-results");

  async function runSearch(query) {
    if (!query) return;

    // ⚡ Placeholder: Replace with real API
    // Example hitting your backend route
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
    const data = await res.json();

    // Clear old results
    resultsContainer.innerHTML = "";

    // Show new results
    if (data.items && data.items.length > 0) {
      data.items.forEach(item => {
        const div = document.createElement("div");
        div.className = "search-result";
        div.innerHTML = `
          <a href="${item.link}" target="_blank">${item.title}</a>
          <p>${item.snippet}</p>
        `;
        resultsContainer.appendChild(div);
      });
    } else {
      resultsContainer.innerHTML = "<p>No results found.</p>";
    }
  }

  button.addEventListener("click", () => {
    runSearch(input.value.trim());
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch(input.value.trim());
  });
});

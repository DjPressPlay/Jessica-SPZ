// ztab-search.js
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("z-start-input");
  const button = document.getElementById("z-search-btn");
  const resultsContainer = document.getElementById("z-search-results");

  async function runSearch(query) {
    if (!query) return;

    resultsContainer.innerHTML = `<p>🔎 Searching for <b>${query}</b>...</p>`;

    try {
      // Call your Netlify function
      const res = await fetch(
        `/.netlify/functions/search?q=${encodeURIComponent(query)}`
      );

      if (!res.ok) throw new Error("Search request failed");

      const data = await res.json();

      // Clear old results
      resultsContainer.innerHTML = "";

      // Render results
      if (data.items && data.items.length > 0) {
        data.items.forEach((item) => {
          const div = document.createElement("div");
          div.className = "search-result";
          div.innerHTML = `
            <h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
            <p>${item.snippet || ""}</p>
          `;
          resultsContainer.appendChild(div);
        });
      } else {
        resultsContainer.innerHTML = `<p>No results found.</p>`;
      }
    } catch (err) {
      resultsContainer.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
  }

  // Click event
  button.addEventListener("click", () => {
    runSearch(input.value.trim());
  });

  // Enter key event
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch(input.value.trim());
  });
});

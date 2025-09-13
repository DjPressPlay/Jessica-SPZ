// public/ztab-search.js
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("z-start-input");
  const button = document.getElementById("z-search-btn");
  const resultsContainer = document.getElementById("z-search-results");

  async function runSearch(query) {
    if (!query) return;

    resultsContainer.innerHTML = `<p>🔎 Searching for <b>${query}</b>...</p>`;

    try {
      const res = await fetch(
        `/.netlify/functions/search?q=${encodeURIComponent(query)}`
      );

      if (!res.ok) throw new Error("Search request failed");

      const data = await res.json();

      resultsContainer.innerHTML = "";

      // ======================
      // 1. Warp Result
      // ======================
      if (data.warp) {
        const warpDiv = document.createElement("div");
        warpDiv.className = "warp-result";
        warpDiv.innerHTML = `
          <h2>⚡ Warp Result</h2>
          <h3><a href="${data.warp.link}" target="_blank">${data.warp.title}</a></h3>
          <p>${data.warp.snippet || ""}</p>
          <hr>
        `;
        resultsContainer.appendChild(warpDiv);
      }

      // ======================
      // 2. All Other Results
      // ======================
      if (data.items && data.items.length > 0) {
        data.items.forEach((item, idx) => {
          // skip if it's the warp (avoid duplication)
          if (data.warp && item.link === data.warp.link) return;

          const div = document.createElement("div");
          div.className = "search-result";
          div.innerHTML = `
            <h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
            <p>${item.snippet || ""}</p>
            <small>[${item.source}]</small>
          `;
          resultsContainer.appendChild(div);
        });
      } else {
        resultsContainer.innerHTML += "<p>No results found.</p>";
      }
    } catch (err) {
      resultsContainer.innerHTML = `<p style="color:red;">Error: ${err.message}</p>`;
    }
  }

  // Button click
  button.addEventListener("click", () => {
    runSearch(input.value.trim());
  });

  // Enter key
  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch(input.value.trim());
  });
});

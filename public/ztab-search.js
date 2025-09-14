OK REWRITE THE ZTAB SEARCH JS WITH THE UPDATE 
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
      // Warp Result Highlight
      // ======================
      if (data.warp) {
        const warpDiv = document.createElement("div");
        warpDiv.className = "result-item";
        warpDiv.style.border = "2px solid #4285f4"; // highlight border
        warpDiv.style.padding = "12px";
        warpDiv.style.borderRadius = "8px";
        warpDiv.style.marginBottom = "20px";
        warpDiv.innerHTML = `
          <h3><a href="${data.warp.link}" target="_blank">${data.warp.title}</a></h3>
          <p class="result-snippet">${data.warp.snippet || ""}</p>
          <small>[${data.warp.source || "warp"}]</small>
        `;
        resultsContainer.appendChild(warpDiv);
      }

      // ======================
      // All Results List
      // ======================
      if (data.items && data.items.length > 0) {
        data.items.forEach((item) => {
          // Skip duplicate of warp
          if (data.warp && item.link === data.warp.link) return;

          const div = document.createElement("div");
          div.className = "result-item";
          div.innerHTML = `
            <h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
            <p class="result-snippet">${item.snippet || ""}</p>
            <small>[${item.source || "unknown"}]</small>
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

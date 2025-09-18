// public/ztab-search.js
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("z-start-input");
  const button = document.getElementById("z-search-btn");
  const button2 = document.getElementById("z-search-btn2");
  const input2 = document.getElementById("z-start-input2");

  const resultsContainer = document.getElementById("z-search-results");

  async function runSearch(query) {
    if (!query) return;

    resultsContainer.innerHTML = `<p>🔎 Searching for <b>${query}</b>...</p>`;

    try {
      const res = await fetch(
        `/.netlify/functions/search-with-images?q=${encodeURIComponent(query)}`
      );

      if (!res.ok) throw new Error("Search request failed");

      const data = await res.json();

      resultsContainer.innerHTML = "";

      // ======================
      // Highlights Section
      // ======================
      if (data.highlights && data.highlights.length > 0) {
        const highlightWrapper = document.createElement("div");
        highlightWrapper.className = "highlight-wrapper";
        highlightWrapper.style.display = "grid";
        highlightWrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(250px, 1fr))";
        highlightWrapper.style.gap = "16px";
        highlightWrapper.style.marginBottom = "24px";

        data.highlights.forEach((item) => {
          let source = item.source || "warp";
          if (source === "searchapi") source = "search-io";

          const card = document.createElement("div");
          card.className = "highlight-item";
          card.style.border = "2px solid #4285f4";
          card.style.padding = "12px";
          card.style.borderRadius = "8px";
          card.style.background = "#1e1e1e";

          card.innerHTML = `
            <img src="${item.image}" alt="preview" style="width:100%; max-height:160px; object-fit:cover; border-radius:4px; margin-bottom:8px;" />
            <h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
            <p class="result-snippet">${item.snippet || ""}</p>
            <small>[${source}] — ${item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}</small>
          `;

          highlightWrapper.appendChild(card);
        });

        resultsContainer.appendChild(highlightWrapper);
      }

      // ======================
      // Regular Results Section
      // ======================
      if (data.items && data.items.length > 0) {
        data.items.forEach((item) => {
          let source = item.source || "unknown";
          if (source === "searchapi") source = "search-io";

          const div = document.createElement("div");
          div.className = "result-item";
          div.style.marginBottom = "16px";

          div.innerHTML = `
            <img src="${item.image}" alt="preview" style="width:100%; max-height:160px; object-fit:cover; border-radius:4px; margin-bottom:8px;" />
            <h3><a href="${item.link}" target="_blank">${item.title}</a></h3>
            <p class="result-snippet">${item.snippet || ""}</p>
            <small>[${source}] — ${item.timestamp ? new Date(item.timestamp).toLocaleString() : ""}</small>
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

  button2.addEventListener("click", () => {
    runSearch(input2.value.trim());
  });

  input.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch(input.value.trim());
  });

  input2.addEventListener("keypress", (e) => {
    if (e.key === "Enter") runSearch(input2.value.trim());
  });

});

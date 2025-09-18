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
      // Highlights Section (smaller cards)
      // ======================
      if (data.highlights && data.highlights.length > 0) {
        const highlightWrapper = document.createElement("div");
        highlightWrapper.className = "highlight-wrapper";
        highlightWrapper.style.display = "grid";
        highlightWrapper.style.gridTemplateColumns = "repeat(auto-fit, minmax(140px, 1fr))";
        highlightWrapper.style.gap = "10px";
        highlightWrapper.style.marginBottom = "20px";

        data.highlights.forEach((item) => {
          let source = item.source || "warp";
          if (source === "searchapi") source = "search-io";

          const card = document.createElement("div");
          card.className = "highlight-item";
          card.style.border = "1px solid #4285f4";
          card.style.padding = "8px";
          card.style.borderRadius = "6px";
          card.style.background = "#1e1e1e";
          card.style.maxWidth = "160px";

          card.innerHTML = `
            <img src="${item.image}" alt="preview" 
                 style="width:100%; height:100px; object-fit:cover; border-radius:4px; margin-bottom:6px;" />
            <h4 style="font-size:14px; margin:0 0 4px 0;">
              <a href="${item.link}" target="_blank">${item.title}</a>
            </h4>
            <small>[${source}] ${item.timestamp ? "— " + new Date(item.timestamp).toLocaleString() : ""}</small>
          `;

          highlightWrapper.appendChild(card);
        });

        resultsContainer.appendChild(highlightWrapper);
      }

      // ======================
      // Regular Results Section (YouTube style rows)
      // ======================
      if (data.items && data.items.length > 0) {
        const resultsWrapper = document.createElement("div");
        resultsWrapper.className = "result-list";
        resultsWrapper.style.display = "flex";
        resultsWrapper.style.flexDirection = "column";
        resultsWrapper.style.gap = "12px";

        data.items.forEach((item) => {
          let source = item.source || "unknown";
          if (source === "searchapi") source = "search-io";

          const div = document.createElement("div");
          div.className = "result-item";
          div.style.display = "flex";
          div.style.alignItems = "flex-start";
          div.style.border = "1px solid #333";
          div.style.borderRadius = "6px";
          div.style.background = "#1e1e1e";
          div.style.padding = "8px";
          div.style.gap = "10px";

          div.innerHTML = `
            <img src="${item.image}" alt="preview" 
                 style="width:160px; height:100px; object-fit:cover; border-radius:4px;" />
            <div style="flex:1;">
              <h3 style="margin:0 0 6px 0; font-size:16px;">
                <a href="${item.link}" target="_blank">${item.title}</a>
              </h3>
              <p class="result-snippet" style="margin:0 0 6px 0; font-size:14px; color:#ccc;">
                ${item.snippet || ""}
              </p>
              <small style="color:#888;">[${source}] ${item.timestamp ? "— " + new Date(item.timestamp).toLocaleString() : ""}</small>
            </div>
          `;

          resultsWrapper.appendChild(div);
        });

        resultsContainer.appendChild(resultsWrapper);
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

(function () {
  const state = {
    data: null,
  };

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function text(value) {
    return escapeHtml(value);
  }

  function attr(value) {
    return escapeHtml(value);
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function renderTags(tags) {
    return (tags || []).map((item) => `<span class="tag">${text(item)}</span>`).join("");
  }

  function renderProject(project, index) {
    return `
      <article class="project-row ${index === 0 ? "featured-row" : ""}">
        <div>
          <p class="project-meta">${text(project.meta)}</p>
          <h2>${text(project.name)}</h2>
          <p>${text(project.description)}</p>
        </div>
        <div class="project-row-side">
          <span class="status-pill">${text(project.status)}</span>
          <div class="tag-row">${renderTags(project.stack)}</div>
          <a class="button button-secondary" href="${attr(project.link)}" target="_blank" rel="noreferrer">
            查看仓库
          </a>
          ${
            project.homepage
              ? `<a class="inline-link" href="${attr(project.homepage)}" target="_blank" rel="noreferrer">访问页面</a>`
              : ""
          }
        </div>
      </article>
    `;
  }

  function renderNote(note) {
    return `
      <article class="note-card note-card-large" data-note-category="${attr(note.category)}">
        <p class="note-meta">${text(note.meta)}</p>
        <h2>${text(note.title)}</h2>
        <p>${text(note.excerpt)}</p>
        <div class="tag-row">
          <span class="tag">${text(note.category)}</span>
          <span class="tag">Markdown</span>
        </div>
        <a class="inline-link" href="${attr(note.link)}">在网站阅读</a>
      </article>
    `;
  }

  function wireNoteFilters() {
    const categoryButtons = document.querySelectorAll("[data-category]");
    const noteCards = document.querySelectorAll("[data-note-category]");

    categoryButtons.forEach((button) => {
      button.addEventListener("click", () => {
        const category = button.getAttribute("data-category");

          categoryButtons.forEach((item) => {
          item.classList.remove("active");
          item.setAttribute("aria-pressed", "false");
        });
        button.classList.add("active");
        button.setAttribute("aria-pressed", "true");

        noteCards.forEach((card) => {
          const isVisible =
            category === "全部" || card.getAttribute("data-note-category") === category;
          card.toggleAttribute("hidden", !isVisible);
        });
      });
    });
  }

  function updateProjectPage(data) {
    const directory = document.querySelector(".project-directory");
    if (!directory || !data.projects?.length) return;

    directory.innerHTML = data.projects.map(renderProject).join("");

    const count = document.querySelector(".projects-sketch-hero .route-hero-panel h3");
    const active = document.querySelector(".projects-sketch-hero .route-hero-panel p:last-child");
    if (count) count.textContent = `${data.projects.length} 个项目`;
    if (active) {
      const activeCount =
        data.projects.filter((project) => project.status === "维护中").length || data.projects.length;
      active.textContent = `${activeCount} 个正在维护`;
    }
  }

  function updateNotesPage(data) {
    const directory = document.querySelector(".notes-directory");
    const rail = document.querySelector(".note-rail");
    const list = document.querySelector(".note-list");
    if (!directory || !rail || !list || !data.notes?.length) return;

    const categories = ["全部", ...unique(data.notes.map((note) => note.category))];
    rail.innerHTML = categories
      .map(
        (category, index) => `
          <button
            class="${index === 0 ? "active" : ""}"
            type="button"
            aria-pressed="${index === 0 ? "true" : "false"}"
            data-category="${attr(category)}"
          >
            ${text(category)}
          </button>
        `,
      )
      .join("");

    list.innerHTML = data.notes.map(renderNote).join("");
    wireNoteFilters();

    const count = document.querySelector(".notes-sketch-hero .route-hero-panel h3");
    const categoryCount = document.querySelector(".notes-sketch-hero .route-hero-panel p:last-child");
    if (count) count.textContent = `${data.notes.length} 篇笔记`;
    if (categoryCount) categoryCount.textContent = `${categories.length - 1} 个分类`;
  }

  function updateHomePage(data) {
    const stats = document.querySelector(".poster-wall--overview .poster-stats");
    if (stats && data.projects?.length && data.notes?.length) {
      const activeCount =
        data.projects.filter((project) => project.status === "维护中").length || data.projects.length;
      const latestActivity = data.activities?.[0]?.[0] || "今天";
      stats.innerHTML = `
        <span><strong>${text(data.projects.length)}</strong> 项目</span>
        <span><strong>${text(data.notes.length)}</strong> 笔记</span>
        <span><strong>${text(activeCount)}</strong> 维护中</span>
        <span><strong>${text(latestActivity)}</strong> 最新动态</span>
      `;
    }

    const projectList = document.querySelector(".poster-wall--projects .poster-list");
    if (projectList && data.projects?.length) {
      projectList.innerHTML = data.projects
        .slice(0, 3)
        .map(
          (project) => `
            <a href="${attr(project.link)}" target="_blank" rel="noreferrer">
              <span>
                <strong>${text(project.name)}</strong>
                <small>${text(project.description)}</small>
              </span>
              <em>${text(project.status)} / GitHub</em>
            </a>
          `,
        )
        .join("");
    }

    const noteList = document.querySelector(".poster-wall--notes .poster-note-list");
    if (noteList && data.notes?.length) {
      noteList.innerHTML = data.notes
        .slice(0, 3)
        .map(
          (note) => `
            <a href="${attr(note.link)}">
              <strong>${text(note.title)}</strong>
              <span>${text(note.category)} / ${text(note.meta.split("/").pop()?.trim() || "")}</span>
            </a>
          `,
        )
        .join("");
    }

    const categoryCloud = document.querySelector(".poster-wall--categories .sticky-cloud");
    if (categoryCloud && data.notes?.length) {
      categoryCloud.innerHTML = unique(data.notes.map((note) => note.category))
        .slice(0, 6)
        .map((category) => `<a href="/notes/">${text(category)}</a>`)
        .join("");
    }

    const feed = document.querySelector(".poster-wall--activity .poster-feed");
    if (feed && data.activities?.length) {
      feed.innerHTML = data.activities
        .slice(0, 2)
        .map(
          ([time, title, body]) => `
            <article>
              <time>${text(time)}</time>
              <strong>${text(title)}</strong>
              <p>${text(body)}</p>
            </article>
          `,
        )
        .join("");
    }

    const chart = document.querySelector(".poster-wall--activity .sketch-chart");
    if (chart && data.activityChart?.length) {
      chart.innerHTML = data.activityChart
        .map(
          (day) => `
            <span
              class="${day.count === 0 ? "empty" : ""}"
              style="height:${Number(day.height) || 8}%"
              title="${attr(`${day.label}: ${day.count} 次更新，网站 ${day.website} 次，笔记 ${day.notes} 次`)}"
            ></span>
          `,
        )
        .join("");
    }
  }

  async function loadRuntimeData() {
    try {
      const response = await fetch("/api/site-data", {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) return;

      state.data = await response.json();
      document.documentElement.dataset.runtimeData = "ready";

      updateHomePage(state.data);
      updateProjectPage(state.data);
      updateNotesPage(state.data);

      if (document.querySelector(".scroll-decorations-container")) {
        requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
      }
    } catch (error) {
      document.documentElement.dataset.runtimeData = "fallback";
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadRuntimeData);
  } else {
    loadRuntimeData();
  }
})();

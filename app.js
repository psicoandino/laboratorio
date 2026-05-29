const grid =
document.getElementById(
  "projects-grid"
);

const isMobile =
window.innerWidth <= 768;

let allProjects = [];
let latestProject = null;
let cardCount = 0;

async function loadProjects(){

  const response =
  await fetch("projects.json");

  const projectFolders =
  await response.json();

  for(const folder of projectFolders){

    allProjects.push(folder);

    const metaResponse =
    await fetch(
      `./projects/${folder}/meta.json`
    );

    const project =
    await metaResponse.json();

    if(
      !latestProject ||
      new Date(project.updated) >
      new Date(latestProject.updated)
    ){
      latestProject = project;
    }

    createCard(project, folder);
  }

  renderLatestUpdate();
  setupRandomButton();
  setupProjectFilters();
}

function renderLatestUpdate(){

  document
  .getElementById("last-update")
  .innerHTML = `
    Latest transmission:
    <span>${latestProject.title}</span>
  `;
}

function setupRandomButton(){

  document
  .getElementById("random-btn")
  .addEventListener("click", () => {

    const random =
    allProjects[
      Math.floor(
        Math.random() * allProjects.length
      )
    ];

    window.location.href =
    `./projects/${random}/index.html`;
  });
}

function createCard(project, folder){

  const unavailable =
  isMobile && project.mobile === false;

  cardCount++;

  const index =
  String(cardCount).padStart(2, "0");

  const card =
  document.createElement("article");

  card.className = "card";
  card.dataset.title = project.title.toLowerCase();
  card.dataset.description = project.description.toLowerCase();
  card.dataset.tags = project.tags
    .map(tag => tag.toLowerCase())
    .join(",");

  card.innerHTML = `

    <div class="card-svg">
      ${generateSVG(
        project.svg,
        project.accent
      )}
    </div>

    <div class="card-content">

      <div class="card-top">
        ${
          project.status
          ? `<div class="status-badge">
               ${project.status.toUpperCase()}
             </div>`
          : `<div></div>`
        }
        <span class="card-index">
          ${index}
        </span>
      </div>

      <h2>${project.title}</h2>

      <p>${project.description}</p>

      <div class="card-footer">

        <div class="tags">
          ${project.tags
            .map(tag => `
              <span class="tag">${tag}</span>
            `)
            .join("")
          }
        </div>

        ${
          unavailable
          ? `<div class="disabled-btn">
               Desktop Only
             </div>`
          : `<a
               class="open-btn"
               href="./projects/${folder}/index.html"
             >
               Open
               <span class="arrow">→</span>
             </a>`
        }

      </div>

    </div>
  `;

  addTilt(card);

  grid.appendChild(card);
}

function setupProjectFilters(){

  const filterBar =
  document.createElement("div");

  filterBar.className = "filter-bar";

  const search =
  document.createElement("input");

  search.className = "filter-search";
  search.type = "search";
  search.placeholder = "Search transmissions";
  search.setAttribute("aria-label", "Search projects");

  const tagWrap =
  document.createElement("div");

  tagWrap.className = "filter-tags";

  const tags =
  [...new Set(
    [...document.querySelectorAll(".tag")]
      .map(tag => tag.textContent.trim())
  )];

  let activeTag = "";

  tags.forEach(tag => {

    const pill =
    document.createElement("button");

    pill.className = "filter-pill";
    pill.type = "button";
    pill.textContent = tag;
    pill.dataset.tag = tag.toLowerCase();

    pill.addEventListener("click", () => {

      activeTag =
      activeTag === pill.dataset.tag
        ? ""
        : pill.dataset.tag;

      document
      .querySelectorAll(".filter-pill")
      .forEach(item => {
        item.classList.toggle(
          "active",
          item.dataset.tag === activeTag
        );
      });

      filterProjects();
    });

    tagWrap.appendChild(pill);
  });

  filterBar.append(search, tagWrap);

  grid.parentNode.insertBefore(filterBar, grid);

  search.addEventListener("input", filterProjects);

  function filterProjects(){

    const query =
    search.value.trim().toLowerCase();

    document
    .querySelectorAll(".card")
    .forEach(card => {

      const matchesSearch =
      !query ||
      card.dataset.title.includes(query) ||
      card.dataset.description.includes(query);

      const matchesTag =
      !activeTag ||
      card.dataset.tags.split(",").includes(activeTag);

      card.classList.toggle(
        "filtered-out",
        !(matchesSearch && matchesTag)
      );
    });
  }
}

function addTilt(card){

  card.addEventListener("mousemove", (e) => {

    const r = card.getBoundingClientRect();

    const x = (e.clientX - r.left) / r.width  - 0.5;
    const y = (e.clientY - r.top)  / r.height - 0.5;

    card.style.transition =
    "transform 0.12s ease, border-color 0.4s, box-shadow 0.4s";

    card.style.transform =
    `perspective(900px)
     rotateY(${x * 7}deg)
     rotateX(${-y * 7}deg)
     translateY(-4px)`;
  });

  card.addEventListener("mouseleave", () => {

    card.style.transition =
    "transform 0.6s cubic-bezier(0.23,1,0.32,1), border-color 0.4s, box-shadow 0.4s";

    card.style.transform = "";
  });
}

function generateSVG(type, color){

  if(type === "orbit"){

    return `
      <svg viewBox="0 0 400 400">

        <circle
          cx="200" cy="200" r="140"
          stroke="${color}" stroke-width="0.8"
          fill="none"
        />

        <circle
          cx="200" cy="200" r="90"
          stroke="${color}" stroke-width="0.8"
          fill="none"
        />

        <circle
          cx="200" cy="200" r="45"
          stroke="${color}" stroke-width="0.8"
          fill="none"
        />

        <circle
          cx="272" cy="112" r="9"
          fill="${color}"
        />

        <circle
          cx="148" cy="236" r="5"
          fill="${color}" opacity="0.45"
        />

      </svg>
    `;
  }

  if(type === "grid"){

    return `
      <svg viewBox="0 0 400 400">

        ${Array
          .from({length: 20})
          .map((_, i) => `
            <line
              x1="${i * 20}" y1="0"
              x2="${i * 20}" y2="400"
              stroke="${color}" stroke-width="0.5"
            />
            <line
              x1="0" y1="${i * 20}"
              x2="400" y2="${i * 20}"
              stroke="${color}" stroke-width="0.5"
            />
          `)
          .join("")
        }

      </svg>
    `;
  }

  return `
    <svg viewBox="0 0 400 400">

      <circle
        cx="200" cy="200" r="90"
        stroke="${color}" stroke-width="0.8"
        fill="none"
      />

      ${Array
        .from({length: 12})
        .map((_, i) => {

          const angle = (Math.PI * 2 / 12) * i;

          const x = 200 + Math.cos(angle) * 130;
          const y = 200 + Math.sin(angle) * 130;

          return `
            <circle
              cx="${x}" cy="${y}" r="20"
              stroke="${color}" stroke-width="0.8"
              fill="none"
            />
          `;
        })
        .join("")
      }

    </svg>
  `;
}

loadProjects();

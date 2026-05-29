const isMobile =
window.innerWidth <= 768;

const grid =
document.getElementById(
  "projects-grid"
);

async function loadProjects(){

  const response =
  await fetch("projects.json");

  const projectFolders =
  await response.json();

  for(const folder of projectFolders){

    const metaResponse =
    await fetch(
      `./projects/${folder}/meta.json`
    );

    const project =
    await metaResponse.json();

    createCard(project, folder);
  }
}

function createCard(project, folder){
  const unavailable =
    isMobile && project.mobile === false;

  const card =
  document.createElement("article");

  card.className = "card";

  card.innerHTML = `

    <div class="card-svg">
      ${generateSVG(
        project.svg,
        project.accent
      )}
    </div>

    <div class="card-content">

      <h2>
        ${project.title}
      </h2>

      <p>
        ${project.description}
      </p>

      <div class="tags">

        ${project.tags
          .map(tag => `
            <span class="tag">
              ${tag}
            </span>
          `)
          .join("")
        }

      </div>

      ${
        unavailable
      
        ?
      
        `
          <div class="disabled-btn">
            Desktop Only
          </div>
        `
      
        :
      
        `
          <a
            class="open-btn"
            href="./projects/${folder}/index.html"
          >
            Open →
          </a>
        `
      }

    </div>
  `;

  grid.appendChild(card);
}

function generateSVG(type,color){

  if(type === "orbit"){

    return `

      <svg viewBox="0 0 400 400">

        <circle
          cx="200"
          cy="200"
          r="120"
          stroke="${color}"
          stroke-width="1"
          fill="none"
        />

        <circle
          cx="200"
          cy="200"
          r="80"
          stroke="${color}"
          stroke-width="1"
          fill="none"
        />

        <circle
          cx="260"
          cy="120"
          r="8"
          fill="${color}"
        />

      </svg>
    `;
  }

  if(type === "grid"){

    return `

      <svg viewBox="0 0 400 400">

        ${Array
          .from({length:20})
          .map((_,i)=>`

            <line
              x1="${i*20}"
              y1="0"
              x2="${i*20}"
              y2="400"
              stroke="${color}"
              stroke-width="0.5"
            />

            <line
              x1="0"
              y1="${i*20}"
              x2="400"
              y2="${i*20}"
              stroke="${color}"
              stroke-width="0.5"
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
        cx="200"
        cy="200"
        r="90"
        stroke="${color}"
        stroke-width="1"
        fill="none"
      />

      ${Array
        .from({length:12})
        .map((_,i)=>{

          const angle =
          (Math.PI*2/12)*i;

          const x =
          200 +
          Math.cos(angle)*120;

          const y =
          200 +
          Math.sin(angle)*120;

          return `

            <circle
              cx="${x}"
              cy="${y}"
              r="22"
              stroke="${color}"
              stroke-width="1"
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

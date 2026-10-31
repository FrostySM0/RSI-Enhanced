(() => {
  const releases = [
    {
      version: "4.6", status: "Released", timing: "Q1 2026", tentative: false,
      categories: [
        { name: "Characters", count: 1, cards: [{ title: 'Medical Light Armor “Chiron”', description: 'A new medical light armor set for players operating across the persistent universe.', artwork: "armor", href: "/roadmap/release-view/1490-Medical-Light-Armor-Chiron" }] },
        { name: "Gameplay", count: 1, cards: [{ title: "Cockpit Light Amplification (LAMP)", description: "Low-light cockpit visibility for selected vehicle canopies, helping pilots navigate dark environments.", artwork: "cockpit", href: "/roadmap/release-view/1476-Cockpit-Light-Amplification-LAMP" }] },
        { name: "Locations", count: 1, cards: [{ title: "Kel-To Ship Supply Kiosks", description: "Small Kel-To supply kiosks at major Stanton cities provide crews with engineering tools and essential provisions.", artwork: "station", href: "/roadmap/release-view/1473-Kel-To-Ship-Supply-Kiosks" }] }, { name: "Missions and Events", count: 2 }, { name: "Ships and Vehicles", count: 3 }, { name: "Weapons and Items", count: 2 }
      ]
    },
    {
      version: "4.7", status: "Released", timing: "Q1 2026", tentative: false,
      categories: [
        { name: "AI", count: 2, cards: [
          { title: "Ice Juvenile Valakkar", description: "The juvenile Valakkar can be encountered by players within QV Breaker Stations.", artwork: "ice", href: "/roadmap/release-view/1499-Ice-Juvenile-Valakkar" },
          { title: "Ice Adult Valakkar", description: "An adult Valakkar encounter joins the activity within QV Breaker Stations.", artwork: "ice", href: "/roadmap/release-view/1500-Ice-Adult-Valakkar" }
        ] },
        { name: "Characters", count: 4, cards: [{ title: "New Hairstyles (4.7.0)", description: "Six new hairstyles added to character customization.", artwork: "hair", href: "/roadmap/release-view/1488-New-Hairstyles-470" }] }, { name: "Gameplay", count: 2 }, { name: "Locations", count: 2 }, { name: "Missions and Events", count: 1 }, { name: "Ships and Vehicles", count: 4 }, { name: "Weapons and Items", count: 2 }
      ]
    },
    {
      version: "4.8", status: "Released", timing: "Q2 2026", tentative: false,
      categories: [
        { name: "Characters", count: 2, cards: [{ title: "New Hairstyles (4.8.0)", description: "Seven new hairstyles and one beard, alongside updates to one hairstyle and one beard.", artwork: "hair", href: "/roadmap/release-view/1524-New-Hairstyles-480" }] },
        { name: "Core Tech", count: 2, cards: [{ title: "Transport System", description: "Transit receives a rewrite, starting in Grim Hex and supporting trams, trains, and elevators.", artwork: "station", href: "/roadmap/release-view/1528-Transport-System" }] }, { name: "Gameplay", count: 5 }, { name: "Locations", count: 1 }, { name: "Missions and Events", count: 2 }, { name: "Ships and Vehicles", count: 10 }, { name: "Weapons and Items", count: 3 }
      ]
    },
    {
      version: "4.9", status: "Released", timing: "Q3 2026", tentative: false,
      categories: [
        { name: "AI", count: 1, cards: [{ title: "Juvenile and Adult Valakkar Behavior Updates", description: "Updated Valakkar combat behavior with more dynamic movement and attack patterns.", artwork: "space", href: "/roadmap/release-view/1567-Juvenile-And-Adult-Valakkar-Behavior-Updates" }] },
        { name: "Characters", count: 3, cards: [
          { title: "New Hairstyles (4.9.0)", description: "Two new hairstyles and an update to an existing option.", artwork: "hair", href: "/roadmap/release-view/1554-New-Hairstyles-490" },
          { title: "Bellator Combat Suit", description: "Lightly armored apparel designed to balance style with combat use.", artwork: "armor", href: "/roadmap/release-view/1552-Bellator-Combat-Suit" }
        ] }, { name: "Core Tech", count: 1 }, { name: "Gameplay", count: 2 }, { name: "Missions and Events", count: 1 }, { name: "Ships and Vehicles", count: 2 }, { name: "Weapons and Items", count: 1 }
      ]
    },
    {
      version: "4.10", status: "Released", timing: "Q3 2026", tentative: false,
      categories: [
        { name: "Characters", count: 3, cards: [
          { title: "Mission Giver: Recco Battaglia", description: "An in-person mission giver brings a narrative series to life in Levski, with stories involving independent miners.", artwork: "station", href: "/roadmap/release-view/1561-Mission-Giver-Recco-Battaglia" },
          { title: 'Super Heavy Combat “BUL-H4” Armor', description: "A new armor class planned to support powerful super-heavy weapons.", artwork: "armor", href: "/roadmap/release-view/1551-Super-Heavy-Combat-BUL-H4-Armor" },
          { title: "Character Customization Update (Brows)", description: "Three new eyebrow styles and updates to six existing options.", artwork: "citizen", href: "/roadmap/release-view/1581-Character-Customization-Update-Brows" }
        ] }, { name: "Core Tech", count: 1 }, { name: "Gameplay", count: 2 },
        { name: "Missions and Events", count: 3 },
        { name: "Ships and Vehicles", count: 5 }, { name: "Weapons and Items", count: 3 }
      ]
    },
    {
      version: "4.11", status: "Tentative", timing: "Q4 2026", tentative: true,
      categories: [
        { name: "Characters", count: 1, cards: [{ title: 'Heavy Combat Armor “Monolith”', description: "A heavy combat armor set planned for the persistent universe.", artwork: "monolith", href: "/roadmap/release-view/1580-Heavy-Combat-Armor-Monolith" }] },
        { name: "Core Tech", count: 5, cards: [
          { title: "Genesis: Starchitect", description: "A procedural world-building system for placing sectors, clusters, and modular locations across planetary bodies.", artwork: "space", href: "/roadmap/release-view/1599-Genesis-Starchitect" },
          { title: "Genesis: Planet Tech v5", description: "A planetary generation rework spanning biomes, vegetation, terrain materials, and GPU-based generation.", artwork: "space", href: "/roadmap/release-view/1587-Genesis-Planet-Tech-V5" }
        ] }, { name: "Locations", count: 4 }, { name: "Missions and Events", count: 1 }, { name: "Ships and Vehicles", count: 1 }, { name: "Weapons and Items", count: 4 }
      ]
    },
    {
      version: "Star Citizen 1.0", status: "Tentative", timing: "Undated", tentative: true, partial: true,
      categories: [
        { name: "Characters", count: 1, cards: [{ title: "StarWear", description: "Planned technology combines clothing and armor pieces to broaden character customization.", artwork: "citizen", href: "/roadmap/release-view/1165-StarWear" }] },
        { name: "Core Tech", count: 7, cards: [
          { title: "Dynamic Server Meshing", description: "Dynamic server scaling and reassignment for large-scale player counts.", artwork: "space", href: "/roadmap/release-view/1133-Dynamic-Server-Meshing" },
          { title: "StarAudio", description: "A suite of tools and technology aimed at improving sound quality and fidelity.", artwork: "space", href: "/roadmap/release-view/1139-StarAudio" }
        ] },
        { name: "Gameplay", count: 26 }, { name: "Locations", count: 10 }, { name: "Missions and Events", count: 3 }
      ]
    }
  ];

  // Artwork URLs come from the matching native Roadmap cards, so previews use the same images as RSI.
  const artworkByTitle = {
    'Medical Light Armor “Chiron”': "https://media.robertsspaceindustries.com/b4rgmmt0lfqac/product_thumb_large.jpg",
    "Cockpit Light Amplification (LAMP)": "https://media.robertsspaceindustries.com/0k2kz6i51uxi7/product_thumb_large.png",
    "Kel-To Ship Supply Kiosks": "https://robertsspaceindustries.com/media/sw2kg92evtkc5r/product_thumb_large/02_Shopping_Kelto_FINAL.jpg",
    "Ice Juvenile Valakkar": "https://media.robertsspaceindustries.com/dnjzfq2gqtjgu/product_thumb_large.png",
    "Ice Adult Valakkar": "https://media.robertsspaceindustries.com/hx5lnkllziws5/product_thumb_large.png",
    "New Hairstyles (4.7.0)": "https://media.robertsspaceindustries.com/lz0mmugq9si4b/product_thumb_large.png",
    "New Hairstyles (4.8.0)": "https://media.robertsspaceindustries.com/zqgiwzsawyk8p/product_thumb_large.png",
    "Transport System": "https://media.robertsspaceindustries.com/3fg5tv2e58kaw/product_thumb_large.png",
    "Juvenile and Adult Valakkar Behavior Updates": "https://media.robertsspaceindustries.com/9fpjbtb16vv4j/product_thumb_large.png",
    "New Hairstyles (4.9.0)": "https://media.robertsspaceindustries.com/59j2dtexhugf4/product_thumb_large.png",
    "Bellator Combat Suit": "https://media.robertsspaceindustries.com/zdf3r0wfop5dm/product_thumb_large.jpg",
    "Mission Giver: Recco Battaglia": "https://media.robertsspaceindustries.com/r274orc4x5o1r/product_thumb_large.png",
    'Super Heavy Combat “BUL-H4” Armor': "https://media.robertsspaceindustries.com/d2lry3ght6cae/product_thumb_large.jpg",
    "Character Customization Update (Brows)": "https://media.robertsspaceindustries.com/ovay5huf3jyky/product_thumb_large.png",
    'Heavy Combat Armor “Monolith”': "https://media.robertsspaceindustries.com/4mchpb6qj0d3k/product_thumb_large.png",
    "Genesis: Starchitect": "https://media.robertsspaceindustries.com/1loto2zirazk4/product_thumb_large.jpg",
    "Genesis: Planet Tech v5": "https://media.robertsspaceindustries.com/ojh9gc9qyutlj/product_thumb_large.png",
    "StarWear": "https://media.robertsspaceindustries.com/rpga58vnvq86f/product_thumb_large.png",
    "Dynamic Server Meshing": "https://robertsspaceindustries.com/media/o2c5jq9ywbv9lr/product_thumb_large/ServerMeshingRM.jpg",
    "StarAudio": "https://media.robertsspaceindustries.com/3dufzomtplv2a/product_thumb_large.png"
  };

  const track = document.getElementById("release-track");
  const dialog = document.getElementById("feature-dialog");
  const toast = document.getElementById("preview-toast");
  let toastTimer = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function makeFeatureCard(card, category, release) {
    const button = element("button", `feature-card${release.tentative ? " tentative" : ""}`);
    button.type = "button";
    button.setAttribute("aria-label", `${card.title}. ${release.status}. Open preview details.`);
    button.dataset.cardTitle = card.title;
    button.dataset.description = card.description;
    button.dataset.category = category.name;
    button.dataset.release = release.version;
    button.dataset.releaseStatus = release.status;
    if (card.href) button.dataset.href = card.href;

    const status = element("span", "feature-status");
    status.append(element("span", "", `${release.tentative ? "▤" : "↓"} ${release.status}`));
    status.append(element("span", "external-mark", "↗"));
    button.append(status);
    button.append(element("span", "feature-title", card.title));
    const art = element("span", "feature-art");
    art.setAttribute("aria-hidden", "true");
    const imageUrl = artworkByTitle[card.title];
    if (imageUrl) {
      const image = element("img", "feature-image");
      image.src = imageUrl;
      image.alt = "";
      image.loading = "lazy";
      image.decoding = "async";
      image.addEventListener("error", () => {
        art.classList.add("image-unavailable");
        art.replaceChildren(element("span", "", "Artwork unavailable"));
      }, { once: true });
      art.append(image);
    } else {
      art.classList.add("image-unavailable");
      art.append(element("span", "", "Artwork unavailable"));
    }
    button.append(art);
    button.append(element("span", "feature-description", card.description));
    return button;
  }

  function makeCategory(category, release) {
    const section = element("section", "category");
    const toggle = element("button", "category-toggle");
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "true");
    const textWrap = element("span", "category-label");
    textWrap.append(element("span", "category-name", category.name));
    textWrap.append(element("span", "category-count", `${category.count} ${category.count === 1 ? "entry" : "entries"}`));
    toggle.append(textWrap);
    toggle.append(element("span", "category-chevron", "⌃"));
    const body = element("div", "category-body");
    for (const card of category.cards ?? []) body.append(makeFeatureCard(card, category, release));
    const remaining = category.count - (category.cards?.length ?? 0);
    if (remaining > 0) {
      const more = element("div", "category-more");
      const bold = element("b", "", `${remaining} ${remaining === 1 ? "additional entry" : "additional entries"}`);
      more.append(bold, document.createTextNode(" are part of the live RSI list and are not reproduced in this sample preview."));
      body.append(more);
    }
    const bodyId = `category-${Math.random().toString(36).slice(2, 10)}`;
    body.id = bodyId;
    toggle.setAttribute("aria-controls", bodyId);
    toggle.addEventListener("click", () => {
      const expanded = toggle.getAttribute("aria-expanded") === "true";
      toggle.setAttribute("aria-expanded", String(!expanded));
      body.hidden = expanded;
    });
    section.append(toggle, body);
    return section;
  }

  function makeLane(release) {
    const lane = element("article", `release-lane${release.tentative ? " is-tentative" : ""}`);
    const header = element("header", "lane-header");
    const top = element("div", "lane-topline");
    const heading = element("h3", `lane-version${release.version.length > 8 ? " long" : ""}`, release.version);
    const collapse = element("button", "lane-collapse", "−");
    collapse.type = "button";
    collapse.setAttribute("aria-label", `Collapse ${release.version} release lane`);
    collapse.setAttribute("aria-expanded", "true");
    collapse.addEventListener("click", () => {
      const expanded = collapse.getAttribute("aria-expanded") === "true";
      lane.classList.toggle("lane-collapsed", expanded);
      collapse.setAttribute("aria-expanded", String(!expanded));
      collapse.textContent = expanded ? "+" : "−";
      collapse.setAttribute("aria-label", `${expanded ? "Expand" : "Collapse"} ${release.version} release lane`);
    });
    top.append(heading, collapse);
    const state = element("div", "lane-state");
    state.append(element("span", "lane-state-icon", release.tentative ? "▤" : "↓"));
    state.append(document.createTextNode(`${release.status}${release.timing === "Undated" ? "" : `, ${release.timing}`}`));
    header.append(top, state);
    if (release.partial) {
      const note = element("div", "category-more", "Partial list shown: these categories were visible in the checked RSI snapshot.");
      note.style.margin = "7px 8px 0";
      header.append(note);
    }
    const content = element("div", "lane-content");
    for (const category of release.categories) content.append(makeCategory(category, release));
    lane.append(header, content);
    return lane;
  }

  function render() {
    track.replaceChildren(...releases.map(makeLane));
  }

  function notify(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 3600);
  }

  function setAllCategories(expanded) {
    for (const toggle of track.querySelectorAll(".category-toggle")) {
      toggle.setAttribute("aria-expanded", String(expanded));
      const body = document.getElementById(toggle.getAttribute("aria-controls"));
      if (body) body.hidden = !expanded;
    }
  }

  document.getElementById("expand-all").addEventListener("click", () => setAllCategories(true));
  document.getElementById("collapse-all").addEventListener("click", () => setAllCategories(false));
  document.querySelectorAll(".track-arrow").forEach(button => button.addEventListener("click", () => {
    const direction = Number(button.dataset.scroll) || 1;
    track.scrollBy({ left: direction * Math.max(300, track.clientWidth * 0.8), behavior: "smooth" });
  }));

  document.getElementById("previous-releases").addEventListener("click", event => {
    const button = event.currentTarget;
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    notify("Older release columns load from RSI. The local preview keeps its verified sample set only.");
  });

  track.addEventListener("click", event => {
    const card = event.target.closest(".feature-card");
    if (!card) return;
    document.getElementById("dialog-status").textContent = card.dataset.releaseStatus.toUpperCase();
    document.getElementById("dialog-status").classList.toggle("tentative", card.dataset.releaseStatus === "Tentative");
    document.getElementById("dialog-category").textContent = card.dataset.category;
    document.getElementById("dialog-title").textContent = card.dataset.cardTitle;
    document.getElementById("dialog-description").textContent = card.dataset.description;
    document.getElementById("dialog-release").replaceChildren(document.createTextNode("RELEASE "), element("b", "", card.dataset.release));
    const nativeLink = document.getElementById("dialog-native-link");
    if (card.dataset.href) {
      nativeLink.href = `https://robertsspaceindustries.com${card.dataset.href}`;
      nativeLink.hidden = false;
    } else {
      nativeLink.hidden = true;
      nativeLink.removeAttribute("href");
    }
    dialog.showModal();
  });

  dialog.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => dialog.close()));
  dialog.addEventListener("click", event => { if (event.target === dialog) dialog.close(); });
  render();
})();

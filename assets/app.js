(() => {
  const body = document.body;
  document.querySelectorAll("[data-sidebar-toggle]").forEach((button) => {
    button.addEventListener("click", () => body.classList.toggle("sidebar-open"));
  });

  const searchInputs = [...document.querySelectorAll("[data-module-search]")];
  const cards = [...document.querySelectorAll("[data-module-card]")];
  const sideLinks = [...document.querySelectorAll("[data-side-module]")];
  const groups = [...document.querySelectorAll("[data-module-group]")];
  const empty = document.querySelector("[data-empty-search]");

  const applySearch = (rawValue) => {
    const value = rawValue.trim().toLocaleLowerCase("zh-CN");
    searchInputs.forEach((input) => {
      if (input.value !== rawValue) input.value = rawValue;
    });

    let visibleCards = 0;
    cards.forEach((card) => {
      const match = !value || (card.dataset.searchText || "").toLocaleLowerCase("zh-CN").includes(value);
      card.classList.toggle("is-hidden", !match);
      if (match) visibleCards += 1;
    });

    sideLinks.forEach((link) => {
      const match = !value || (link.dataset.searchText || "").toLocaleLowerCase("zh-CN").includes(value);
      link.classList.toggle("is-hidden", !match);
    });

    groups.forEach((group) => {
      const hasVisible = [...group.querySelectorAll("[data-module-card]")].some(
        (card) => !card.classList.contains("is-hidden"),
      );
      group.classList.toggle("is-hidden", !hasVisible);
    });

    if (empty) empty.hidden = visibleCards !== 0;
  };

  searchInputs.forEach((input) => {
    input.addEventListener("input", (event) => applySearch(event.target.value));
  });

  document.querySelectorAll(".side-link,.side-home").forEach((link) => {
    link.addEventListener("click", () => body.classList.remove("sidebar-open"));
  });
})();

(()=>{
  const slugify = (value) => {
    if (!value) return null;
    const slug = value
      .toString()
      .trim()
      .toLowerCase()
      .replace(/&/g, "-and-")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    return slug || null;
  };

  const addClassesFromAttribute = (attribute, baseClass) => {
    const selector = `[${attribute}]`;
    document.querySelectorAll(selector).forEach((element) => {
      const raw = element.getAttribute(attribute);
      const slug = slugify(raw);
      if (!slug) return;

      if (!element.classList.contains(baseClass)) {
        element.classList.add(baseClass);
      }

      const semanticClass = `${baseClass}-${slug}`;
      if (!element.classList.contains(semanticClass)) {
        element.classList.add(semanticClass);
      }
    });
  };

  document.addEventListener("DOMContentLoaded", () => {
    document.body.classList.add("page", "page--Slither");
    addClassesFromAttribute("data-framer-name", "section");
    addClassesFromAttribute("data-framer-component-type", "component");
    addClassesFromAttribute("data-code-component-plugin-id", "plugin");
  });
})();

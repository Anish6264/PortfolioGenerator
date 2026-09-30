document.addEventListener("DOMContentLoaded", () => {
  const links = [...document.querySelectorAll(".masthead nav a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    const current = entries.find((entry) => entry.isIntersecting);
    if (!current) return;
    links.forEach((link) => {
      if (link.hash === `#${current.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-22% 0px -64% 0px" });
  sections.forEach((section) => observer.observe(section));
});

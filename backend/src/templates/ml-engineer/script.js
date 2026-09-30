document.addEventListener("DOMContentLoaded", () => {
  const links = [...document.querySelectorAll(".topbar nav a[href^='#']")];
  const sections = links.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window) || !sections.length) return;

  const observer = new IntersectionObserver((entries) => {
    const active = entries.find((entry) => entry.isIntersecting);
    if (!active) return;
    links.forEach((link) => {
      if (link.hash === `#${active.target.id}`) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-20% 0px -65% 0px" });
  sections.forEach((section) => observer.observe(section));
});

document.addEventListener("DOMContentLoaded", () => {
  const navLinks = [...document.querySelectorAll(".creative-header nav a[href^='#']")];
  const sections = navLinks.map((link) => document.querySelector(link.getAttribute("href"))).filter(Boolean);
  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        if (link.hash === `#${entry.target.id}`) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
      entry.target.classList.add("in-view");
    });
  }, { rootMargin: "-18% 0px -65% 0px" });
  sections.forEach((section) => observer.observe(section));
});

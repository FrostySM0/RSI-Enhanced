const faqAnimations = new WeakMap();
const FAQ_MOTION_MS = 260;

document.addEventListener("click", (event) => {
  if (!(event.target instanceof Element)) return;

  const summary = event.target.closest(".faq-item > summary");
  const item = summary?.parentElement;
  if (!(item instanceof HTMLDetailsElement) || typeof item.animate !== "function") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  event.preventDefault();

  const previous = faqAnimations.get(item);
  const currentHeight = item.getBoundingClientRect().height;
  const targetOpen = !(previous?.targetOpen ?? item.open);
  previous?.animation.cancel();

  item.open = true;
  item.style.height = "auto";
  const expandedHeight = item.getBoundingClientRect().height;
  const style = window.getComputedStyle(item);
  const collapsedHeight = summary.getBoundingClientRect().height
    + Number.parseFloat(style.borderTopWidth || "0")
    + Number.parseFloat(style.borderBottomWidth || "0");

  item.style.height = `${currentHeight}px`;
  item.style.overflow = "hidden";

  const state = {
    targetOpen,
    animation: item.animate(
      [
        { height: `${currentHeight}px` },
        { height: `${targetOpen ? expandedHeight : collapsedHeight}px` },
      ],
      { duration: FAQ_MOTION_MS, easing: "cubic-bezier(.2,.7,.2,1)", fill: "both" },
    ),
  };
  faqAnimations.set(item, state);

  state.animation.addEventListener("finish", () => {
    if (faqAnimations.get(item) !== state) return;
    item.open = targetOpen;
    item.style.removeProperty("height");
    item.style.removeProperty("overflow");
    faqAnimations.delete(item);
    state.animation.cancel();
  }, { once: true });
});

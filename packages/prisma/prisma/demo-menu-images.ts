/**
 * Generated food photos shipped with the API at /demo-menu/*.webp.
 * Produced by scripts/generate-demo-menu-images.mjs — not hotlinked.
 */
export const DEMO_MENU_IMAGES: Record<string, string> = {
  "paneer-tikka": "/demo-menu/paneer-tikka.webp",
  "chicken-wings": "/demo-menu/chicken-wings.webp",
  "veg-spring-roll": "/demo-menu/veg-spring-roll.webp",
  "butter-chicken": "/demo-menu/butter-chicken.webp",
  "dal-makhani": "/demo-menu/dal-makhani.webp",
  "margherita-pizza": "/demo-menu/margherita-pizza.webp",
  "veg-biryani": "/demo-menu/veg-biryani.webp",
  "butter-naan": "/demo-menu/butter-naan.webp",
  "garlic-naan": "/demo-menu/garlic-naan.webp",
  "masala-chai": "/demo-menu/masala-chai.webp",
  "fresh-lime-soda": "/demo-menu/fresh-lime-soda.webp",
  "cold-coffee": "/demo-menu/cold-coffee.webp",
  "gulab-jamun": "/demo-menu/gulab-jamun.webp",
  "brownie": "/demo-menu/brownie.webp",
  "matka-chai": "/demo-menu/matka-chai.webp",
  "cutting-chai": "/demo-menu/cutting-chai.webp",
  "filter-coffee": "/demo-menu/filter-coffee.webp",
  "samosa": "/demo-menu/samosa.webp",
  "vada-pav": "/demo-menu/vada-pav.webp",
  "maska-bun": "/demo-menu/maska-bun.webp",
  "chai-samosa-combo": "/demo-menu/chai-samosa-combo.webp",
  "coffee-bun-combo": "/demo-menu/coffee-bun-combo.webp",
  espresso: "/demo-menu/espresso.webp",
  cappuccino: "/demo-menu/cappuccino.webp",
  latte: "/demo-menu/latte.webp",
  "green-tea": "/demo-menu/green-tea.webp",
  "chai-latte": "/demo-menu/chai-latte.webp",
  croissant: "/demo-menu/croissant.webp",
};

export function demoMenuImageUrl(slug: string): string | undefined {
  return DEMO_MENU_IMAGES[slug];
}

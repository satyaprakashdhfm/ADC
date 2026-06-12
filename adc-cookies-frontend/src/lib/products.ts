export interface ProductDoc {
  name: string;
  slug: string;
  tag: string;
  image: string;
  price: number;
  description: string;
  sweetness: string;
  texture: string;
  making: string[];
  highlights: string[];
}

export const PRODUCT_DOCS: ProductDoc[] = [
  {
    name: 'Chocolate Chip',
    slug: 'chocolate-chip',
    tag: 'Classic',
    image: '/assets/products/blueberry.jpg',
    price: 60,
    description: 'The original. Buttery dough, browned-butter base and premium dark chocolate chips, crisp at the edges and gooey at the core.',
    sweetness: 'Balanced medium sweetness with a dark-chocolate finish.',
    texture: 'Crisp rim, soft middle, molten chocolate pockets.',
    making: ['Brown butter for a deeper caramel aroma.', 'Fold in dark chocolate chips after the dough rests.', 'Bake hot so the edges set while the center stays soft.'],
    highlights: ['Classic comfort flavor', 'Best served warm', 'Great for first-time ADC orders'],
  },
  {
    name: 'Double Choc Chip',
    slug: 'double-choc-chip',
    tag: 'Bestseller',
    image: '/assets/products/triple-choc.jpg',
    price: 65,
    description: 'Rich cocoa dough loaded with extra-dark chocolate chunks and a dusting of Dutch cocoa. Fudgy and impossible to resist.',
    sweetness: 'Deep chocolate sweetness with a slightly bitter cocoa balance.',
    texture: 'Dense, fudgy, and soft with chunky chocolate bites.',
    making: ['Blend cocoa into the butter base.', 'Add dark chocolate chunks generously.', 'Bake until just set for a brownie-like center.'],
    highlights: ['Intense cocoa profile', 'A bestseller for chocolate lovers', 'Pairs well with cold milk or coffee'],
  },
  {
    name: 'Raagi (Gluten Free)',
    slug: 'raagi-gluten-free',
    tag: 'Gluten Free',
    image: '/assets/products/oatmeal-raisin.jpg',
    price: 60,
    description: 'Wholesome finger-millet cookie, naturally gluten free, with warm nutty depth and just the right chew.',
    sweetness: 'Gentle sweetness with earthy millet notes.',
    texture: 'Tender, chewy, and slightly rustic.',
    making: ['Use raagi flour as the base.', 'Rest the dough so the grain hydrates evenly.', 'Bake low enough to preserve a soft bite.'],
    highlights: ['Naturally gluten free', 'Nutty and wholesome', 'A lighter everyday cookie'],
  },
  {
    name: 'Matcha',
    slug: 'matcha',
    tag: 'Premium',
    image: '/assets/products/matcha.jpg',
    price: 90,
    description: 'Stone-ground matcha folded into buttery dough with cacao-butter white-chocolate chips.',
    sweetness: 'Creamy sweetness balanced by grassy matcha bitterness.',
    texture: 'Soft and buttery with smooth white-chocolate pockets.',
    making: ['Sift matcha into the flour to avoid bitterness pockets.', 'Fold white chocolate through chilled dough.', 'Bake gently to keep the green tea flavor clean.'],
    highlights: ['Premium tea-shop flavor', 'Elegant sweet-bitter balance', 'Distinctive green color'],
  },
  {
    name: 'ADC Special',
    slug: 'adc-special',
    tag: 'Signature',
    image: '/assets/products/adc-special.jpg',
    price: 90,
    description: 'Our crown jewel: slow-browned butter, three kinds of premium chocolate, and hand-harvested sea-salt flakes.',
    sweetness: 'Rich sweetness lifted by a clean sea-salt finish.',
    texture: 'Thick, gooey, and layered with chocolate.',
    making: ['Brown butter slowly for nutty depth.', 'Layer multiple chocolates into the dough.', 'Finish with flaky salt just before baking.'],
    highlights: ['Signature ADC flavor', 'Three-chocolate build', 'Made for gifting and cravings'],
  },
  {
    name: 'Red Velvet With Cheese',
    slug: 'red-velvet-with-cheese',
    tag: 'Premium',
    image: '/assets/products/red-velvet.jpg',
    price: 90,
    description: 'Deep cocoa-red velvet dough wrapped around a tangy cream-cheese centre that softens as it bakes.',
    sweetness: 'Dessert-forward sweetness with a tangy cheese center.',
    texture: 'Soft red velvet shell with a creamy middle.',
    making: ['Mix cocoa into the red velvet dough.', 'Pipe a chilled cream-cheese center.', 'Seal and bake until the filling turns silky.'],
    highlights: ['Cream cheese filled', 'Rich cocoa note', 'Celebration-ready color'],
  },
  {
    name: 'Biscoff Filled',
    slug: 'biscoff-filled',
    tag: 'Bestseller',
    image: '/assets/products/peanut-butter.jpg',
    price: 110,
    description: 'Caramelised cookie shell around a warm, molten river of Belgian Lotus Biscoff spread.',
    sweetness: 'High caramel sweetness with spiced biscuit warmth.',
    texture: 'Soft shell with a flowing filled center.',
    making: ['Chill Biscoff filling so it can be wrapped cleanly.', 'Build a buttery cookie shell around it.', 'Bake until the center turns molten.'],
    highlights: ['Molten Biscoff center', 'Best eaten warm', 'Big indulgent bite'],
  },
  {
    name: 'Nutella Filled',
    slug: 'nutella-filled',
    tag: 'Recommended',
    image: '/assets/products/caramel-cashew.jpg',
    price: 90,
    description: 'A gooey Nutella centre tucked inside a soft chocolate cookie. Absolutely irresistible warm.',
    sweetness: 'Chocolate-hazelnut sweetness with a creamy finish.',
    texture: 'Soft cookie body with a gooey center.',
    making: ['Portion and chill Nutella filling.', 'Wrap with chocolate dough.', 'Bake just enough to keep the center glossy.'],
    highlights: ['Hazelnut chocolate center', 'Warm and gooey', 'Crowd-friendly flavor'],
  },
  {
    name: 'Nutella Tin',
    slug: 'nutella-tin',
    tag: 'Gift',
    image: '/assets/products/coffee-almond.jpg',
    price: 600,
    description: 'Six premium Nutella-filled cookies in a keepsake gift tin. Perfect for gifting and celebrations.',
    sweetness: 'Sweet, creamy, and generous across every cookie.',
    texture: 'Fresh filled cookies packed to travel well.',
    making: ['Bake Nutella-filled cookies in small batches.', 'Cool just enough for neat packing.', 'Arrange in a reusable tin with gift-ready finishing.'],
    highlights: ['Six-cookie gift tin', 'Premium packaging', 'Good for birthdays and office gifting'],
  },
  {
    name: 'Biscoff Tin',
    slug: 'biscoff-tin',
    tag: 'Gift',
    image: '/assets/products/m-and-m.jpg',
    price: 850,
    description: 'Nine Biscoff-filled cookies, gift-ready in a premium tin with a ribbon wrap and name tag.',
    sweetness: 'Caramel-sweet, spiced, and indulgent.',
    texture: 'Filled cookies kept soft inside a premium tin.',
    making: ['Prepare the Biscoff-filled batch fresh.', 'Pack nine cookies into the tin.', 'Finish with ribbon wrap and name tag.'],
    highlights: ['Nine-cookie premium tin', 'Excellent for sharing', 'Strong gifting presentation'],
  },
];

export function productPath(name: string) {
  const product = PRODUCT_DOCS.find((item) => item.name === name);
  return product ? `/products/${product.slug}` : `/products/${slugify(name)}`;
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export interface ProductDoc {
  name: string;
  slug: string;
  tag: string;
  image: string;
  price: number;
  description: string;
  sweetness: string;
  texture: string;
  story: string;
  ingredients: string[];
  serving: string;
  storage: string;
  pairing: string;
  making: string[];
  highlights: string[];
}

export const PRODUCT_DOCS: ProductDoc[] = [
  {
    name: 'Chocolate Chip Cookie',
    slug: 'chocolate-chip',
    tag: 'Classic',
    image: '/assets/products/blueberry.jpg',
    price: 60,
    description: 'Golden-baked cookie loaded with premium chocolate chips, perfectly crisp outside and soft, chewy inside.',
    sweetness: 'Balanced medium sweetness with a dark-chocolate finish.',
    texture: 'Crisp rim, soft middle, molten chocolate pockets.',
    story: 'Chocolate Chip is the cookie that sets the A Dough Cookie standard: familiar, warm, and built around the smell of butter and chocolate. It is designed for customers who want a classic cookie that still feels bakery-made and premium.',
    ingredients: ['Browned butter dough', 'Dark chocolate chips', 'Vanilla', 'Brown sugar', 'Sea salt finish'],
    serving: 'Best eaten warm within a few minutes of delivery, when the chocolate is soft and the center is still tender.',
    storage: 'Keep in an airtight box for up to 2 days. Warm for 8-10 seconds before serving.',
    pairing: 'Pairs beautifully with cold milk, hot coffee, or a simple vanilla shake.',
    making: ['Brown butter for a deeper caramel aroma.', 'Fold in dark chocolate chips after the dough rests.', 'Bake hot so the edges set while the center stays soft.'],
    highlights: ['Classic comfort flavor', 'Best served warm', 'Great for first-time A Dough Cookie orders'],
  },
  {
    name: 'Double Choco Chip Cookie',
    slug: 'double-choc-chip',
    tag: 'Bestseller',
    image: '/assets/products/triple-choc.jpg',
    price: 65,
    description: 'A rich chocolate cookie packed with double chocolate chips for an intensely fudgy, chocolate-loaded experience.',
    sweetness: 'Deep chocolate sweetness with a slightly bitter cocoa balance.',
    texture: 'Dense, fudgy, and soft with chunky chocolate bites.',
    story: 'Double Choc Chip is made for serious chocolate cravings. The cocoa dough gives the cookie a brownie-like body, while dark chocolate chunks bring pockets of richness in every bite.',
    ingredients: ['Cocoa cookie dough', 'Dark chocolate chunks', 'Dutch cocoa', 'Brown sugar', 'Butter'],
    serving: 'Serve slightly warm so the chocolate chunks soften without losing the fudgy bite.',
    storage: 'Store airtight for up to 2 days. Reheat briefly and avoid over-warming so it stays dense.',
    pairing: 'Pairs with espresso, cold coffee, or vanilla ice cream.',
    making: ['Blend cocoa into the butter base.', 'Add dark chocolate chunks generously.', 'Bake until just set for a brownie-like center.'],
    highlights: ['Intense cocoa profile', 'A bestseller for chocolate lovers', 'Pairs well with cold milk or coffee'],
  },
  {
    name: 'Ragi Cookie (Gluten-Free)',
    slug: 'raagi-gluten-free',
    tag: 'Gluten Free',
    image: '/assets/products/oatmeal-raisin.jpg',
    price: 60,
    description: 'Wholesome gluten-free ragi cookie with a hearty bite, balanced sweetness, and satisfying crunch.',
    sweetness: 'Gentle sweetness with earthy millet notes.',
    texture: 'Tender, chewy, and slightly rustic.',
    story: "Raagi is A Dough Cookie's lighter, earthier cookie for customers who want a wholesome option without giving up the joy of a fresh bake. It keeps the bite soft while letting finger millet bring a naturally nutty character.",
    ingredients: ['Raagi flour', 'Butter', 'Brown sugar', 'Vanilla', 'A pinch of salt'],
    serving: 'Best with tea or coffee, especially when warmed just enough to bring back the soft chew.',
    storage: 'Store airtight for up to 2 days. Keep away from moisture to preserve the cookie texture.',
    pairing: 'Pairs with masala chai, filter coffee, or unsweetened milk.',
    making: ['Use raagi flour as the base.', 'Rest the dough so the grain hydrates evenly.', 'Bake low enough to preserve a soft bite.'],
    highlights: ['Naturally gluten free', 'Nutty and wholesome', 'A lighter everyday cookie'],
  },
  {
    name: 'Matcha Cookie',
    slug: 'matcha',
    tag: 'Premium',
    image: '/assets/products/matcha.jpg',
    price: 90,
    description: 'Buttery cookie infused with premium matcha, delivering earthy notes balanced with subtle sweetness.',
    sweetness: 'Creamy sweetness balanced by grassy matcha bitterness.',
    texture: 'Soft and buttery with smooth white-chocolate pockets.',
    story: 'Matcha brings a calm, tea-forward flavor to the A Dough Cookie menu. The cookie is built around a sweet-bitter balance, using white chocolate to round out the green tea notes without hiding them.',
    ingredients: ['Matcha powder', 'Butter cookie dough', 'White chocolate chips', 'Vanilla', 'Fine sugar'],
    serving: 'Serve at room temperature or gently warmed. Too much heat can mute the tea aroma.',
    storage: 'Store airtight away from sunlight to protect the matcha color and flavor.',
    pairing: 'Pairs with iced latte, jasmine tea, or vanilla milk.',
    making: ['Sift matcha into the flour to avoid bitterness pockets.', 'Fold white chocolate through chilled dough.', 'Bake gently to keep the green tea flavor clean.'],
    highlights: ['Premium tea-shop flavor', 'Elegant sweet-bitter balance', 'Distinctive green color'],
  },
  {
    name: 'ADC Special Cookie',
    slug: 'adc-special',
    tag: 'Signature',
    image: '/assets/products/adc-special.jpg',
    price: 90,
    description: 'Our signature brownie-inspired cookie with a rich chocolatey center, crisp edges, and irresistibly gooey bites.',
    sweetness: 'Rich sweetness lifted by a clean sea-salt finish.',
    texture: 'Thick, gooey, and layered with chocolate.',
    story: 'A Dough Cookie Special is the signature cookie: the one that should taste like the brand in a single bite. It layers browned butter, multiple chocolates, and sea salt so the cookie feels indulgent without becoming flat or overly sweet.',
    ingredients: ['Browned butter dough', 'Dark chocolate', 'Milk chocolate', 'White chocolate', 'Flaky sea salt'],
    serving: 'Best served warm, when the chocolate layers soften and the salt lands cleanly at the finish.',
    storage: 'Store airtight for up to 2 days. Warm for 10 seconds before serving for the full signature texture.',
    pairing: 'Pairs with cappuccino, cold milk, or a scoop of vanilla ice cream.',
    making: ['Brown butter slowly for nutty depth.', 'Layer multiple chocolates into the dough.', 'Finish with flaky salt just before baking.'],
    highlights: ['Signature A Dough Cookie flavor', 'Three-chocolate build', 'Made for gifting and cravings'],
  },
  {
    name: 'Red Velvet Filled Cookie',
    slug: 'red-velvet-with-cheese',
    tag: 'Premium',
    image: '/assets/products/red-velvet.jpg',
    price: 90,
    description: 'Soft red velvet cookie with a luscious cream cheese filling for the perfect sweet balance.',
    sweetness: 'Dessert-forward sweetness with a tangy cheese center.',
    texture: 'Soft red velvet shell with a creamy middle.',
    story: 'Red Velvet With Cheese turns a classic cake flavor into a filled cookie. The cocoa-red dough gives it depth, while the cream-cheese center adds tang and softness.',
    ingredients: ['Red velvet cocoa dough', 'Cream cheese filling', 'Butter', 'Vanilla', 'Fine sugar'],
    serving: 'Serve warm for a soft filling or room temperature for a cleaner cream-cheese bite.',
    storage: 'Store chilled if keeping overnight because of the cream-cheese filling. Warm gently before eating.',
    pairing: 'Pairs with hot chocolate, cold milk, or a light coffee.',
    making: ['Mix cocoa into the red velvet dough.', 'Pipe a chilled cream-cheese center.', 'Seal and bake until the filling turns silky.'],
    highlights: ['Cream cheese filled', 'Rich cocoa note', 'Celebration-ready color'],
  },
  {
    name: 'Biscoff Filled Cookie',
    slug: 'biscoff-filled',
    tag: 'Bestseller',
    image: '/assets/products/peanut-butter.jpg',
    price: 110,
    description: 'Warm cookie filled with creamy Biscoff spread and crunchy Lotus Biscoff biscuit piece.',
    sweetness: 'High caramel sweetness with spiced biscuit warmth.',
    texture: 'Soft shell with a flowing filled center.',
    story: 'Biscoff Filled is built for the first-break moment: crack the cookie open and the caramel-spiced center turns glossy and molten. It is rich, fragrant, and made for customers who want a big dessert-style cookie.',
    ingredients: ['Buttery cookie dough', 'Lotus Biscoff spread', 'Brown sugar', 'Cinnamon-style spice notes', 'Vanilla'],
    serving: 'Serve warm so the Biscoff center flows. Eat with a spoon if you want the full molten moment.',
    storage: 'Store airtight for up to 2 days. Reheat gently so the filling loosens without overheating.',
    pairing: 'Pairs with black coffee, cold milk, or a vanilla milkshake.',
    making: ['Chill Biscoff filling so it can be wrapped cleanly.', 'Build a buttery cookie shell around it.', 'Bake until the center turns molten.'],
    highlights: ['Molten Biscoff center', 'Best eaten warm', 'Big indulgent bite'],
  },
  {
    name: 'Nutella Filled Cookie',
    slug: 'nutella-filled',
    tag: 'Recommended',
    image: '/assets/products/caramel-cashew.jpg',
    price: 90,
    description: 'Freshly baked cookie overflowing with rich, molten Nutella in every indulgent bite.',
    sweetness: 'Chocolate-hazelnut sweetness with a creamy finish.',
    texture: 'Soft cookie body with a gooey center.',
    story: 'Nutella Filled is the easy crowd favorite. The chocolate cookie shell keeps the bite soft, while the hazelnut center brings a creamy, familiar sweetness.',
    ingredients: ['Chocolate cookie dough', 'Nutella filling', 'Butter', 'Cocoa', 'Brown sugar'],
    serving: 'Best warm, when the Nutella center turns glossy and spoon-soft.',
    storage: 'Store airtight for up to 2 days. Warm for 8-10 seconds before serving.',
    pairing: 'Pairs with cold coffee, milk, or strawberries on the side.',
    making: ['Portion and chill Nutella filling.', 'Wrap with chocolate dough.', 'Bake just enough to keep the center glossy.'],
    highlights: ['Hazelnut chocolate center', 'Warm and gooey', 'Crowd-friendly flavor'],
  },
  {
    name: 'Nutella Cookie Tin',
    slug: 'nutella-tin',
    tag: 'Gift',
    image: '/assets/products/coffee-almond.jpg',
    price: 600,
    description: 'Soft-baked cookies generously filled with creamy Nutella for an irresistible chocolate indulgence.',
    sweetness: 'Sweet, creamy, and generous across every cookie.',
    texture: 'Fresh filled cookies packed to travel well.',
    story: 'Nutella Tin is designed as a polished gift box for people who love chocolate-hazelnut flavors. It gives customers a ready-to-carry present that still feels fresh and personal.',
    ingredients: ['Six Nutella-filled cookies', 'Chocolate cookie dough', 'Premium tin packaging', 'Gift-ready finishing'],
    serving: 'Open, warm individual cookies for a few seconds, and serve directly from the tin for sharing.',
    storage: 'Keep the tin closed in a cool, dry place for up to 2 days. Avoid direct heat.',
    pairing: 'Pairs with celebration coffee, milkshakes, or a dessert table.',
    making: ['Bake Nutella-filled cookies in small batches.', 'Cool just enough for neat packing.', 'Arrange in a reusable tin with gift-ready finishing.'],
    highlights: ['Six-cookie gift tin', 'Premium packaging', 'Good for birthdays and office gifting'],
  },
  {
    name: 'Biscoff Cookie Tin',
    slug: 'biscoff-tin',
    tag: 'Gift',
    image: '/assets/products/m-and-m.jpg',
    price: 850,
    description: 'Freshly baked Biscoff cookies layered with creamy Biscoff spread and crunchy biscuit crumbles.',
    sweetness: 'Caramel-sweet, spiced, and indulgent.',
    texture: 'Filled cookies kept soft inside a premium tin.',
    story: 'Biscoff Tin is the generous sharing box: nine filled cookies with a strong caramel-spice identity. It is built for office tables, family visits, celebrations, and gifting moments that need to feel abundant.',
    ingredients: ['Nine Biscoff-filled cookies', 'Buttery cookie dough', 'Lotus Biscoff spread', 'Premium tin packaging', 'Ribbon and name tag'],
    serving: 'Warm cookies individually before serving so each one opens with a soft Biscoff center.',
    storage: 'Keep sealed in the tin for up to 2 days. Store in a cool, dry place.',
    pairing: 'Pairs with black coffee, chai, or a shared dessert spread.',
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

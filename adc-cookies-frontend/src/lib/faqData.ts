// Shared FAQ content — powers both the Doughie chatbot and (via the footer) the "FAQs" entry
// point. Keeping the copy in one place means the chatbot and any future FAQ page stay in sync.
export interface FaqItem { q: string; a: string }
export interface FaqCategory { key: string; label: string; emoji: string; items: FaqItem[] }

export const FAQ_CATEGORIES: FaqCategory[] = [
  {
    key: 'product', emoji: '🍪', label: 'Product & Ingredients',
    items: [
      { q: 'What makes A Dough Cookie special?', a: '100% eggless, baked live, and irresistibly soft. Fresh from our oven to your cravings.' },
      { q: 'Are all your cookies freshly baked?', a: 'Always. Every batch is baked fresh because old cookies just aren’t our thing.' },
      { q: 'What ingredients do you use?', a: 'Real butter, premium couverture chocolate, brown sugar, flour, and ingredients we’re proud of.' },
      { q: 'Do your cookies contain preservatives?', a: 'Never. Just honest ingredients and fresh baking—nothing extra, nothing unnecessary.' },
      { q: 'Which cookie is your bestseller?', a: 'Our Nutella Filled Cookie. One bite and you’ll understand the hype.' },
      { q: 'Which cookie should I try first?', a: 'Start with the Nutella Filled Cookie. It’s our unofficial welcome gift to your taste buds.' },
    ],
  },
  {
    key: 'eggless', emoji: '🥚', label: 'Eggless',
    items: [
      { q: 'Are all your cookies 100% eggless?', a: 'Absolutely. Every single cookie we bake is proudly 100% eggless.' },
      { q: 'How do you make cookies without eggs?', a: 'That’s the ADC magic. We perfect the recipe—you just enjoy every bite.' },
      { q: 'Do eggless cookies taste different?', a: 'Only in the best way. We prove eggless can be every bit as indulgent.' },
      { q: 'Are all your products vegetarian?', a: 'Yes! Everything on our menu is completely vegetarian.' },
      { q: 'Is there any chance of egg cross-contamination?', a: 'No. Our kitchen is dedicated to maintaining a completely eggless environment.' },
      { q: 'Are your desserts also eggless?', a: 'Of course. Every dessert we serve stays true to our 100% eggless promise.' },
    ],
  },
  {
    key: 'allergens', emoji: '🌾', label: 'Allergens & Dietary Information',
    items: [
      { q: 'Do your cookies contain gluten?', a: 'Only our Ragi Cookies are gluten-free. Most other cookies contain wheat.' },
      { q: 'Do your cookies contain dairy?', a: 'Yes. We use real butter because great cookies deserve the real deal.' },
      { q: 'Do your cookies contain nuts?', a: 'Most of our cookies are nut-free, but please check specific flavors before ordering.' },
      { q: 'Which flavors are nut-free?', a: 'Almost all our cookie flavors are nut-free. Just ask DOUGHI for confirmation anytime.' },
      { q: 'Are your cookies made in a shared kitchen?', a: 'No. We maintain dedicated baking practices to ensure consistent quality.' },
      { q: 'Can I see the ingredient list before ordering?', a: 'Absolutely! Our core ingredients include real butter, couverture chocolate, brown sugar, and flour.' },
    ],
  },
  {
    key: 'ordering', emoji: '🛒', label: 'Ordering',
    items: [
      { q: 'How can I place an order?', a: 'Order directly through our website or simply give us a call.' },
      { q: 'Can I schedule an order for a future date?', a: 'Yes! Plan ahead and we’ll bake it fresh for your chosen date.' },
      { q: 'Can I modify or cancel my order?', a: 'Since every order is baked fresh just for you, modifications and cancellations aren’t possible.' },
      { q: 'Is there a minimum order quantity?', a: 'No minimums. One cookie or one hundred—we’re happy either way.' },
      { q: 'Can I mix different cookie flavors in one box?', a: 'Absolutely! Mix, match, and build your perfect cookie box.' },
    ],
  },
  {
    key: 'delivery', emoji: '🚚', label: 'Delivery',
    items: [
      { q: 'Where do you deliver?', a: 'We deliver happiness across Pan India.' },
      { q: 'Do you offer same-day delivery?', a: 'Currently available in Bangalore and Chennai for selected locations.' },
      { q: 'How much is the delivery charge?', a: 'Delivery charges vary based on your location and order value.' },
      { q: 'How long does delivery take?', a: 'Most Pan India orders arrive within 3–5 business days.' },
      { q: 'Can I choose my delivery time?', a: 'Yes, for Bangalore and Chennai deliveries wherever available.' },
      { q: 'What if my order arrives damaged?', a: 'We pack every order with care. If something isn’t right, our support team is here to help.' },
    ],
  },
  {
    key: 'corporate', emoji: '🎁', label: 'Corporate Gifting',
    items: [
      { q: 'Do you offer corporate gifting?', a: 'Absolutely! Sweeten your team’s day with our premium cookie gifting.' },
      { q: 'What is the minimum quantity for bulk orders?', a: 'Bulk orders start from just 20 boxes.' },
      { q: 'Can gift boxes be customized?', a: 'Yes! We customize gift boxes to match your occasion or brand.' },
      { q: 'Can you add our company logo or branding?', a: 'Absolutely. Your branding, our cookies—a pretty sweet partnership.' },
      { q: 'Do you deliver bulk orders to multiple locations?', a: 'Yes! We can coordinate deliveries across multiple destinations.' },
      { q: 'Do you provide GST invoices?', a: 'Yes, GST invoices are available on request for bulk and corporate orders.' },
    ],
  },
  {
    key: 'packaging', emoji: '🎀', label: 'Custom Packaging',
    items: [
      { q: 'Can I customize the packaging?', a: 'Absolutely! Great cookies deserve equally beautiful packaging.' },
      { q: 'Can I include a personalized message?', a: 'Of course. Add a heartfelt note and we’ll include it with your order.' },
      { q: 'Do you offer packaging for birthdays, weddings, or special occasions?', a: 'Definitely! We have gifting options for every celebration worth remembering.' },
      { q: 'Can I choose the cookies inside my gift box?', a: 'Yes! Fill your box with all your favorites.' },
    ],
  },
  {
    key: 'franchise', emoji: '🤝', label: 'Franchise',
    items: [
      { q: 'Do you offer franchise opportunities?', a: 'Yes! Call 88616 57617 and let’s build something delicious together.' },
      { q: 'What is the investment required?', a: 'Please contact 88616 57617 for investment details and franchise information.' },
      { q: 'What support do you provide to franchise partners?', a: 'We offer end-to-end guidance. Contact 88616 57617 to know more.' },
      { q: 'How can I apply for a franchise?', a: 'Simply call 88616 57617, and our team will guide you through the process.' },
    ],
  },
  {
    key: 'payments', emoji: '💳', label: 'Payments',
    items: [
      { q: 'Which payment methods do you accept?', a: 'UPI, credit cards, and debit cards—all quick and secure.' },
      { q: 'Do you accept UPI and credit/debit cards?', a: 'Absolutely! Paying for cookies has never been easier.' },
      { q: 'Is Cash on Delivery (COD) available?', a: 'Not at the moment. We currently accept prepaid orders only.' },
      { q: 'How do refunds work?', a: 'Approved refunds are credited back to your original payment method.' },
    ],
  },
  {
    key: 'storage', emoji: '🍪', label: 'Storage & Freshness',
    items: [
      { q: 'How should I store my cookies?', a: 'Keep them in an airtight container to lock in freshness.' },
      { q: 'How long do the cookies stay fresh?', a: 'Up to 7 days when stored properly in an airtight container.' },
      { q: 'How can I reheat my cookies for the best taste?', a: 'Microwave for about 30 seconds and enjoy that fresh-from-the-oven feeling.' },
    ],
  },
  {
    key: 'support', emoji: '📞', label: 'Customer Support',
    items: [
      { q: 'How can I contact customer support?', a: 'Call us at 88616 57617 and we’ll be happy to help.' },
      { q: 'What are your customer support hours?', a: 'Our team is available every day from 11:00 AM to 7:00 PM.' },
      { q: 'How can I report an issue with my order?', a: 'Contact us at 88616 57617 or use the Help section on our website.' },
    ],
  },
  {
    key: 'featured', emoji: '⭐', label: 'Featured Questions',
    items: [
      { q: 'Are all your cookies 100% eggless?', a: 'Absolutely. Every cookie and dessert we bake is proudly 100% eggless.' },
      { q: 'Which cookie is your bestseller?', a: 'The Nutella Filled Cookie—our crowd favorite for a very delicious reason.' },
      { q: 'How can I place an order?', a: 'Order online through our website or simply give us a call.' },
      { q: 'Do you offer same-day delivery?', a: 'Yes! Same-day delivery is currently available in Bangalore and Chennai.' },
      { q: 'Can I customize a gift box?', a: 'Absolutely! Choose your favorite cookies, packaging, and even add a personal message.' },
      { q: 'Do you offer corporate gifting?', a: 'Yes! From team celebrations to client gifting, we’ve got your cookie moments covered.' },
      { q: 'Do you offer franchise opportunities?', a: 'Yes! Call 88616 57617 and let’s bring ADC to your city.' },
      { q: 'How should I store my cookies?', a: 'Store them in an airtight container and they’ll stay fresh for up to 7 days.' },
    ],
  },
];

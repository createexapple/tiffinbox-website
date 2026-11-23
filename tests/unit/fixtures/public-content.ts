/** A document in the exact shape of `get_public_content()` (docs/database.md sec. 5.2, openapi PublicContent). */
export function publicContentDocument(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const slots: Record<string, unknown>[] = [];
  const meals = ['breakfast', 'lunch', 'dinner'] as const;
  for (let day = 1; day <= 7; day += 1) {
    for (const meal of meals) {
      slots.push({
        day_of_week: day,
        meal,
        dish_text: `${meal} on day ${day}`,
        not_served: day === 7 && meal === 'breakfast',
        image: null,
      });
    }
  }
  return {
    schema_version: 1,
    release: { version: 3, published_at: '2026-11-22T13:00:00+00:00' },
    settings: {
      business_name: 'Tiffin Box',
      tagline: 'Ghar ka khana, Ammi ke pyaar jaisa',
      whatsapp_number: '920000000000',
      instagram_handle: 'tiffinbox.lhr',
      order_hours: '9 AM to 9 PM',
      last_order_time: '20:00',
      area_served: 'Johar Town, Lahore',
      delivery_area_text: 'Johar Town, including hostels around UMT.',
      delivery_boundary_text: 'Between Canal Road and Raiwind Road',
      legal_name_and_address: 'Sample Foods (Pvt) Ltd, Lahore',
      delivery_times: { breakfast: '08:00', lunch: '13:00', dinner: '20:00' },
      skip_cutoffs: { breakfast: '22:00', lunch: '10:00', dinner: '17:00' },
      skip_cutoff_days: { breakfast: 'night_before', lunch: 'same_day', dinner: 'same_day' },
      skips_per_week: 3,
      payment_methods: ['JazzCash', 'Easypaisa', 'bank transfer'],
    },
    pricing_rules: {
      monthly_saving_percent: 5,
      breakfast_addon_price: 350,
      team_deal_text: 'a team discount and one monthly invoice',
      team_min_people: 10,
    },
    plans: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: 'Budget',
        audience: 'Hostel students',
        meals_included: 'Lunch + dinner, daal or sabzi + 2 roti',
        price_unit: 'per_meal',
        unit_price: 300,
        weekly_price: 4200,
        monthly_price: 15960,
        is_most_popular: false,
        sort_order: 1,
      },
      {
        id: '10000000-0000-4000-8000-000000000004',
        name: 'All 3 Meals',
        audience: 'People who do not cook',
        meals_included: 'Breakfast + lunch + dinner',
        price_unit: 'per_day',
        unit_price: 1500,
        weekly_price: 10500,
        monthly_price: 39900,
        is_most_popular: true,
        sort_order: 2,
      },
    ],
    dishes: [{ id: 'd1', name: 'Daal chawal', comes_with: 'Full plate', price: 550, image: null }],
    addons: [{ id: 'a1', name: 'Raita', price: 80 }],
    faq: [{ id: 'f1', question: 'Where do you deliver?', answer: 'Johar Town.' }],
    page_images: {},
    menu: {
      week_start: '2026-11-23',
      went_live_at: '2026-11-22T13:00:00+00:00',
      is_current_week: true,
      slots,
    },
    ...overrides,
  };
}

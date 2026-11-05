import type { IncompleteItem, Locale, RejectionReason } from "./types"

type Vars = { province?: string | null; country?: string | null; items?: IncompleteItem[]; currency?: string }

const itemList = (items: IncompleteItem[] = []) => {
  const names = items.map((i) => i.title || i.variant_id)
  return names.length > 3 ? `${names.slice(0, 3).join(", ")} (+${names.length - 3})` : names.join(", ")
}

const MESSAGES: Record<Locale, Record<RejectionReason, (v: Vars) => string>> = {
  id: {
    unknown_service: () => "Opsi pengiriman ini tidak tersedia. Silakan pilih opsi lain.",
    no_address: () => "Isi alamat pengiriman dulu untuk menghitung ongkir.",
    unknown_province: (v) =>
      v.province
        ? `Ongkir ke provinsi "${v.province}" belum bisa dihitung. Periksa lagi provinsi di alamat pengiriman.`
        : "Pilih provinsi di alamat pengiriman untuk menghitung ongkir.",
    unsupported_country: (v) =>
      `Opsi pengiriman ini belum melayani ${v.country ? v.country.toUpperCase() : "negara tujuan"}. Silakan pilih opsi lain atau hubungi kami.`,
    incomplete_items: (v) =>
      `Ongkir belum bisa dihitung karena berat/ukuran produk berikut belum lengkap: ${itemList(v.items)}. Hubungi kami, nanti kami bantu.`,
    no_items: () => "Keranjang tidak berisi barang yang perlu dikirim.",
    no_exchange_rate: (v) => `Ongkir dalam ${v.currency?.toUpperCase()} belum bisa dihitung. Hubungi kami.`,
  },
  en: {
    unknown_service: () => "This shipping option isn't available. Please choose another one.",
    no_address: () => "Enter your shipping address to calculate shipping.",
    unknown_province: (v) =>
      v.province
        ? `We can't calculate shipping to "${v.province}" yet. Please check the province in your shipping address.`
        : "Select the province in your shipping address to calculate shipping.",
    unsupported_country: (v) =>
      `This shipping option doesn't deliver to ${v.country ? v.country.toUpperCase() : "this country"} yet. Please choose another option or contact us.`,
    incomplete_items: (v) =>
      `We can't calculate shipping yet because the weight or size of these products is missing: ${itemList(v.items)}. Please contact us and we'll help.`,
    no_items: () => "Your cart has nothing that needs shipping.",
    no_exchange_rate: (v) => `Shipping in ${v.currency?.toUpperCase()} can't be calculated yet. Please contact us.`,
  },
}

export function rejectionMessage(reason: RejectionReason, locale: Locale, vars: Vars = {}): string {
  return MESSAGES[locale][reason](vars)
}

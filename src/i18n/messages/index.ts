import type { Locale } from "../config";
import common from "./common";
import nav from "./nav";
import enums from "./enums";
import dashboard from "./dashboard";
import products from "./products";
import suppliers from "./suppliers";
import count from "./count";
import inventory from "./inventory";
import locations from "./locations";
import members from "./members";
import analytics from "./analytics";

const namespaces = { common, nav, enums, dashboard, products, suppliers, count, inventory, locations, members, analytics };

export type Messages = { [K in keyof typeof namespaces]: (typeof namespaces)[K]["zh-TW"] };

const cache = new Map<Locale, Messages>();

export function getMessages(locale: Locale): Messages {
  let m = cache.get(locale);
  if (!m) {
    m = Object.fromEntries(Object.entries(namespaces).map(([k, ns]) => [k, ns[locale]])) as Messages;
    cache.set(locale, m);
  }
  return m;
}

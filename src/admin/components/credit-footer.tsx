import { Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { CONFIG_QUERY_KEY, getConfig } from "../lib/api"

const HOME_URL = "https://hauskayu.com/?utm_source=medusa-admin&utm_medium=plugin&utm_campaign=fl-medusa-zone-rate"
const HELP_URL = "https://github.com/haustex/fl-medusa-zone-rate/issues"

/** Small plugin credit under the plugin's own pages; off with the plugin option `showCredit: false`. */
export const CreditFooter = () => {
  const { t } = useTranslation()
  const { data } = useQuery({ queryKey: CONFIG_QUERY_KEY, queryFn: getConfig, staleTime: Infinity })
  if (!data?.show_credit) return null
  return (
    <div className="px-6 py-4 text-center">
      <Text size="xsmall" leading="compact" className="text-ui-fg-muted">
        <a href={HOME_URL} target="_blank" rel="noopener noreferrer" className="hover:text-ui-fg-subtle">
          {t("zoneRate.credit.text")}
        </a>
        {" · "}
        <a href={HELP_URL} target="_blank" rel="noopener noreferrer" className="underline hover:text-ui-fg-subtle">
          {t("zoneRate.credit.help")}
        </a>
      </Text>
    </div>
  )
}

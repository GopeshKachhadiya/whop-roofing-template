// One shared loader for the Whop Elements script. Browser only.
import { loadWhop } from '@whop/elements'

let loader: ReturnType<typeof loadWhop> | null = null

export function getWhop(): ReturnType<typeof loadWhop> {
  if (!loader) loader = loadWhop()
  return loader
}

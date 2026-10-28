/**
 * WE2 console — host half.
 *
 * The skin lives entirely in the browser bundle (`./client`, discovered through
 * the `dsh.client` manifest). This half only satisfies the Cordis entry so the
 * profile can mount the package; it registers no service and no Host behavior.
 */

export const name = 'dsh-ui-we2'

/**
 * Activate the package's Host entry.
 * @param _ctx - owning Cordis context; nothing is registered.
 */
export function apply(_ctx) {}

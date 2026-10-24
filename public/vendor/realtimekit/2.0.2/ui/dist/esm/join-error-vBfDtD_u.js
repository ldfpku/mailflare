/**
 * Maps a caught joinRoom() error to a user-friendly message and a support reference code.
 *
 * Use `err.code` as the primary branch — error codes are the stable SDK contract.
 * The secondary `err.message` check for '0014' is intentional: the SDK sets a distinct
 * message ('A firewall or network restriction may be blocking the connection.') for the
 * ICE failure sub-case, which requires different user advice than a generic media failure.
 *
 * Only codes '0002' and '0014' are thrown by Client.join() today. The default branch
 * handles any unknown or future codes gracefully.
 */
function getJoinErrorInfo(t, err) {
    const code = err === null || err === void 0 ? void 0 : err.code;
    switch (code) {
        case '0002':
            return { message: t('join.network_error'), code };
        case '0014': {
            const isFirewall = typeof (err === null || err === void 0 ? void 0 : err.message) === 'string' && err.message.includes('firewall');
            return {
                message: isFirewall ? t('join.media_firewall_error') : t('join.media_error'),
                code,
            };
        }
        default:
            return { message: t('join.default_error'), code };
    }
}

export { getJoinErrorInfo as g };

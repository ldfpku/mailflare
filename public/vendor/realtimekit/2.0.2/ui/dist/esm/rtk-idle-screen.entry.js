import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import { c as createDefaultConfig, e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import './livestream-C0vp-Q7v.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkIdleScreenCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.ctr{display:flex;flex-direction:column;align-items:center;gap:var(--rtk-space-8, 32px)}.no-network-badge{margin-top:var(--rtk-space-2, 8px);display:flex;width:100%;flex-direction:row;align-items:center;justify-content:flex-start;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));background-color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.1);padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px);font-size:12px;color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.75)}.no-network-badge rtk-icon{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px)}.error-state{display:flex;width:100%;flex-direction:column;align-items:center}.troubleshoot-link{margin-top:var(--rtk-space-1, 4px);font-size:12px;--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-400, 53 110 253) / var(--tw-text-opacity));text-decoration-line:underline;text-underline-offset:2px}.troubleshoot-link:hover{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity))}.error-code{margin-top:var(--rtk-space-1, 4px);font-size:10px;color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}rtk-logo.loaded{height:var(--rtk-space-12, 48px)}rtk-spinner{height:var(--rtk-space-12, 48px);width:var(--rtk-space-12, 48px);--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-text-opacity))}`;

var __decorate = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkIdleScreen = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Config object */
        this.config = createDefaultConfig();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.socketStateUpdate = ({ state }) => {
            var _a;
            this.connectionState = state;
            if (state === 'connected') {
                if (!((_a = this.states) === null || _a === void 0 ? void 0 : _a.preJoinError)) {
                    this.preJoinError = undefined;
                }
            }
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting, undefined);
        this.statesChanged(this.states);
    }
    disconnectedCallback() {
        var _a, _b;
        (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.meta) === null || _b === void 0 ? void 0 : _b.removeListener('socketConnectionUpdate', this.socketStateUpdate);
    }
    meetingChanged(meeting, oldMeeting) {
        var _a, _b, _c, _d;
        (_a = oldMeeting === null || oldMeeting === void 0 ? void 0 : oldMeeting.meta) === null || _a === void 0 ? void 0 : _a.removeListener('socketConnectionUpdate', this.socketStateUpdate);
        if (!meeting)
            return;
        this.connectionState = (_c = (_b = meeting.meta) === null || _b === void 0 ? void 0 : _b.socketState) === null || _c === void 0 ? void 0 : _c.state;
        (_d = meeting.meta) === null || _d === void 0 ? void 0 : _d.addListener('socketConnectionUpdate', this.socketStateUpdate);
    }
    statesChanged(states) {
        this.preJoinError = states === null || states === void 0 ? void 0 : states.preJoinError;
    }
    render() {
        var _a, _b;
        const errorMessage = (_a = this.preJoinError) === null || _a === void 0 ? void 0 : _a.message;
        const errorCode = (_b = this.preJoinError) === null || _b === void 0 ? void 0 : _b.code;
        const showSocketError = !!this.connectionState && this.connectionState !== 'connected' && !errorMessage;
        const errorText = errorMessage
            ? errorMessage
            : this.connectionState === 'failed'
                ? this.t('network.lost_extended')
                : this.t('network.lost');
        return (h(Host, { key: '5fbe382c783b15c48e8eeed8bed062e6a80bffca' }, h("slot", { key: '45e242986aad838894c2f27292f163d62367398c' }, h("div", { key: '7d67aec81786055ece1ab723628a8d574497a89a', class: "ctr", part: "container" }, h("rtk-logo", { key: '4619a800a8a28678d7872a0c246a92d1a08ec359', meeting: this.meeting, config: this.config, t: this.t, part: "logo" }), errorMessage || showSocketError ? (h("div", { class: "error-state" }, h("div", { class: "no-network-badge", part: "network-badge", role: "alert" }, h("rtk-icon", { size: "md", variant: "danger", icon: this.iconPack.disconnected, part: "network-badge-icon" }), errorText), this.meeting && errorMessage && (h("a", { class: "troubleshoot-link", href: `https://test.realtime.cloudflare.com?authToken=${this.meeting.__internals__.authToken}`, target: "_blank", rel: "noopener noreferrer" }, this.t('network.troubleshoot'))), errorCode && (h("span", { class: "error-code", part: "error-code" }, this.t('join.error_code'), ": ", errorCode)))) : (h("rtk-spinner", { "aria-label": "Idle, waiting for meeting data", part: "spinner", iconPack: this.iconPack }))))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "states": [{
                "statesChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkIdleScreen.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkIdleScreen.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkIdleScreen.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkIdleScreen.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkIdleScreen.prototype, "t", void 0);
RtkIdleScreen.style = rtkIdleScreenCss();

export { RtkIdleScreen as rtk_idle_screen };

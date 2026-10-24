import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import { c as createDefaultConfig, e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import './livestream-C0vp-Q7v.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkPipToggleCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block}:host([data-hidden]){display:none}`;

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
const RtkPipToggle = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Variant */
        this.variant = 'button';
        /** Config */
        this.config = createDefaultConfig();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.pipSupported = false;
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    meetingChanged(meeting) {
        var _a, _b, _c;
        if (!meeting)
            return;
        // Check if PiP is supported and enabled
        this.pipSupported =
            ((_a = meeting.participants.pip) === null || _a === void 0 ? void 0 : _a.isSupported()) &&
                ((_b = meeting.self.config) === null || _b === void 0 ? void 0 : _b.pipMode) &&
                ((_c = meeting.self.config) === null || _c === void 0 ? void 0 : _c.viewType) !== 'LIVESTREAM';
    }
    togglePip() {
        if (!this.meeting.participants.pip)
            return;
        // Not active, activate
        if (this.meeting.participants.pip.isActive) {
            this.meeting.participants.pip.disable();
        }
        else {
            this.meeting.participants.pip.enable();
        }
        this.stateUpdate.emit({ activeMoreMenu: false });
    }
    render() {
        if (!this.meeting)
            return null;
        if (!this.pipSupported)
            return h(Host, { "data-hidden": true });
        const pipEnabled = this.meeting.participants.pip.isActive;
        return (h(Host, { role: "log", "aria-label": `Picture-in-Picture mode` }, h("rtk-controlbar-button", { part: "controlbar-button", size: this.size, iconPack: this.iconPack, onClick: () => this.togglePip(), icon: pipEnabled ? this.iconPack.pip_on : this.iconPack.pip_off, label: pipEnabled ? this.t('pip_off') : this.t('pip_on'), variant: this.variant })));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkPipToggle.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkPipToggle.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkPipToggle.prototype, "config", void 0);
__decorate([
    SyncWithStore()
], RtkPipToggle.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkPipToggle.prototype, "t", void 0);
RtkPipToggle.style = rtkPipToggleCss();

export { RtkPipToggle as rtk_pip_toggle };

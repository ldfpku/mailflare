import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkMuteAllButtonCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block}`;

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
const RtkMuteAllButton = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Variant */
        this.variant = 'button';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.canDisable = false;
        this.permissionsUpdateListener = () => {
            var _a;
            this.canDisable = !!((_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.permissions.canDisableParticipantAudio);
        };
        this.onMuteAll = () => {
            this.stateUpdate.emit({ activeMuteAllConfirmation: true });
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        var _a, _b, _c;
        (_c = (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self) === null || _b === void 0 ? void 0 : _b.permissions) === null || _c === void 0 ? void 0 : _c.removeListener('permissionsUpdate', this.permissionsUpdateListener);
    }
    meetingChanged(meeting) {
        if (!meeting)
            return;
        this.canDisable = !!(meeting === null || meeting === void 0 ? void 0 : meeting.self.permissions.canDisableParticipantAudio);
        meeting.self.permissions.addListener('permissionsUpdate', this.permissionsUpdateListener);
    }
    render() {
        if (!this.meeting)
            return null;
        if (!this.canDisable) {
            return null;
        }
        const label = this.t('mute_all');
        return (h(Host, { title: label }, h("rtk-tooltip", { kind: "block", label: label, part: "tooltip" }, h("rtk-controlbar-button", { part: "controlbar-button", icon: this.iconPack.speaker_off, label: label, size: this.size, iconPack: this.iconPack, variant: this.variant, onClick: this.onMuteAll }))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkMuteAllButton.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkMuteAllButton.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkMuteAllButton.prototype, "t", void 0);
RtkMuteAllButton.style = rtkMuteAllButtonCss();

export { RtkMuteAllButton as rtk_mute_all_button };

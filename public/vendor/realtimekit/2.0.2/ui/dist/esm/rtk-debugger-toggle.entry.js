import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { i as useLanguage, e as defaultIconPack } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';

const rtkDebuggerToggleCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block}`;

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
const RtkDebuggerToggle = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Variant */
        this.variant = 'button';
        /** Language */
        this.t = useLanguage();
        /** Icon pack */
        this.iconPack = defaultIconPack;
    }
    toggleDebugger() {
        var _a;
        this.stateUpdate.emit({
            activeDebugger: !((_a = this.states) === null || _a === void 0 ? void 0 : _a.activeDebugger),
            activeMoreMenu: false,
        });
    }
    render() {
        return (h(Host, { key: '33f74fc915ee6fe35432cda13c27812bc505e516', title: this.t('Troubleshooting') }, h("rtk-controlbar-button", { key: '24981c8bbaaa255dd0c7f77d9ef13eee0c9939a7', size: this.size, iconPack: this.iconPack, onClick: () => this.toggleDebugger(), icon: this.iconPack.debug, label: this.t('Troubleshooting'), variant: this.variant })));
    }
};
__decorate([
    SyncWithStore()
], RtkDebuggerToggle.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkDebuggerToggle.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkDebuggerToggle.prototype, "t", void 0);
__decorate([
    SyncWithStore()
], RtkDebuggerToggle.prototype, "iconPack", void 0);
RtkDebuggerToggle.style = rtkDebuggerToggleCss();

export { RtkDebuggerToggle as rtk_debugger_toggle };

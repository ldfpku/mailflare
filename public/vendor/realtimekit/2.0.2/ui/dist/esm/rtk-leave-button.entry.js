import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';

const rtkLeaveButtonCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block}`;

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
const RtkLeaveButton = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Variant */
        this.variant = 'button';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.leave = () => {
            this.stateUpdate.emit({ activeLeaveConfirmation: true });
        };
    }
    render() {
        const text = this.t('leave');
        return (h(Host, { key: 'b81ffe328736f1df741c1ef1f88a128771b5366e', label: text }, h("rtk-controlbar-button", { key: '0674e4975571a6cbccca1b1252c33405ab8c1cb4', size: this.size, iconPack: this.iconPack, class: "leave red-icon", onClick: this.leave, icon: this.iconPack.call_end, label: text, variant: this.variant, part: "controlbar-button" })));
    }
};
__decorate([
    SyncWithStore()
], RtkLeaveButton.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkLeaveButton.prototype, "t", void 0);
RtkLeaveButton.style = rtkLeaveButtonCss();

export { RtkLeaveButton as rtk_leave_button };

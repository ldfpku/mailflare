import { r as registerInstance, h, a as Host } from './index-gJCRRBX0.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-Daj_55_i.js';

const rtkChatSearchResultsCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;height:100%;flex-direction:column;position:relative;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}`;

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
const RtkChatSearchResults = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.pageSize = 50;
        /** NOTE(ikabra): Core APIs need to be implemented for this, this component is not being used inside chat UI and was broken as standalone. */
        this.searchMessages = async (_timestamp, _size, _reversed) => {
            return [];
        };
        this.nodeRenderer = (messages) => {
            return messages.map((message) => (h("rtk-chat-message", { key: message.id, message: message, disableControls: true })));
        };
    }
    render() {
        return (h(Host, { key: '4ea17889c442ac91c4bb54896c600d17290c0715' }, h("rtk-paginated-list", { key: '8fa700caf9b3a2c7329fb555baf1a979231fa71c', pageSize: this.pageSize, pagesAllowed: 3, fetchData: this.searchMessages, createNodes: this.nodeRenderer })));
    }
};
__decorate([
    SyncWithStore()
], RtkChatSearchResults.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkChatSearchResults.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkChatSearchResults.prototype, "t", void 0);
RtkChatSearchResults.style = rtkChatSearchResultsCss();

export { RtkChatSearchResults as rtk_chat_search_results };

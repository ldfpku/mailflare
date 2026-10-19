import { r as registerInstance, h, a as Host, d as createEvent } from './index-gJCRRBX0.js';
import { C as ChatHead } from './ChatHead-BV_pLIJ6.js';
import { s as sanitizeLink, h as hasOnlyEmojis } from './string-vBD2htwQ.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { g as getExtension, a as getFileSize, d as downloadFile } from './file-6Fkktc2w.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { T as TextMessageView } from './TextMessage-C1lPu3R8.js';
import './date-jvwnrxra.js';
import './chat-DRqOBXqN.js';

var __decorate$2 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkFileMessage = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Date object of now, to calculate distance between dates */
        this.now = new Date();
        /** Whether the message is continued by same user */
        this.isContinued = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** show message in bubble */
        this.showBubble = false;
    }
    render() {
        const link = sanitizeLink(this.message.link);
        return (h(Host, { key: 'b10da5fd1c4c6d80a1e5bf5f35f4956abde0ed5d' }, !this.isContinued && (h(ChatHead, { key: 'fb1384ad8bfc73219b28c4500f78e6c6421ee848', name: this.message.displayName, time: this.message.time, now: this.now })), h("div", { key: '81a067a5567ad160e4398a6f16b21309f81a0c9b', class: {
                body: true,
                bubble: this.showBubble,
            }, part: "body" }, h("div", { key: 'c6eb4b26b0090b7f9fd6af9e79d04c8b4e76a6d1', class: "file" }, h("div", { key: '10e9b854fa0c1f311bb1bc76c90223220c9a10f3', class: "file-data" }, h("div", { key: 'ace6eeb050ad6c656cd215456b69f8b6e9529aec', class: "name" }, this.message.name), h("div", { key: '562de08ebd242e92aeca1fae0aa4823612a60c1c', class: "file-data-split" }, h("div", { key: '968eee3032f98a59da43c0b4604dc597c4bfd94c', class: "ext" }, getExtension(this.message.name)), h("span", { key: '2cb436ffed86b9c3a73ff5feab9d3ec7c8e0ef3b', class: "divider" }), h("div", { key: '9cc1d37edf60fbd3d3538512539a79244ffd74de', class: "size" }, getFileSize(this.message.size)))), h("rtk-button", { key: 'e4eb744391b8fe61bd4d58e3ac3d7d10ee748976', variant: "secondary", kind: "icon", onClick: () => downloadFile(link, { name: this.message.name, fallbackName: 'file' }), part: "button" }, h("rtk-icon", { key: '79efeb36257d970f243d1730d0ac4ad84bc6993d', icon: this.iconPack.download }))))));
    }
};
__decorate$2([
    SyncWithStore()
], RtkFileMessage.prototype, "iconPack", void 0);
__decorate$2([
    SyncWithStore()
], RtkFileMessage.prototype, "t", void 0);

const rtkImageMessageCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.image-spinner{cursor:wait}.image-errored{cursor:not-allowed}`;

var __decorate$1 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkImageMessage = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Date object of now, to calculate distance between dates */
        this.now = new Date();
        /** Whether the message is continued by same user */
        this.isContinued = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** show message in bubble */
        this.showBubble = false;
        this.status = 'loading';
    }
    render() {
        return (h(Host, { key: '8ac3f237a8d77254219f8b5763dd6b53d2cb764b' }, !this.isContinued && (h(ChatHead, { key: '6eb17e16b4fd4e12d3b8a7ce8a5bcfd548930a50', name: this.message.displayName, time: this.message.time, now: this.now })), h("div", { key: 'd5cce1675057a0378425452898fcbc4c738b7bb2', class: {
                body: true,
                bubble: this.showBubble,
            }, part: "body" }, h("div", { key: '45f073d8268c92aee4fec8b139fd325e668dab76', class: { image: true, loaded: this.status === 'loaded' } }, h("img", { key: '28a206e34b791205e042233ee7f317f389f421da', src: sanitizeLink(this.message.link), onLoad: () => {
                this.status = 'loaded';
            }, onError: () => {
                this.status = 'errored';
            }, onClick: () => {
                if (this.status === 'loaded') {
                    this.stateUpdate.emit({ image: this.message });
                }
            } }), this.status === 'loading' && (h("div", { key: 'b7862bff3f6c9df7042bdab2f6b0370e7c362f02', class: "image-spinner", title: this.t('chat.img.loading'), "aria-label": this.t('chat.img.loading') }, h("rtk-spinner", { key: '460074eae700cd3f522019f967ba5955b9eb972e', iconPack: this.iconPack }))), this.status === 'errored' && (h("div", { key: 'bdf48c8fdc5057d2c77d10b64d7af5576f478556', class: "image-errored", title: this.t('chat.error.img_not_found'), "aria-label": this.t('chat.error.img_not_found') }, h("rtk-icon", { key: '523e5ff6dd4579082e5953346155df9b7b23862f', icon: this.iconPack.image_off }))), this.status === 'loaded' && (h("div", { key: '89e3679101615838ec6a0f521b98386454d25197', class: "actions" }, h("rtk-button", { key: 'ccaed0a3d70945d66e7b700e01bbc5289421f8ae', class: "action", variant: "secondary", kind: "icon", onClick: () => {
                this.stateUpdate.emit({ image: this.message });
            } }, h("rtk-icon", { key: 'ee20f5497dbb38590de65c4a404eda90b0d5c4e5', icon: this.iconPack.full_screen_maximize })), h("rtk-button", { key: '181d39cfd837e45d3da1aa0fa0f97226c50cb46a', class: "action", variant: "secondary", kind: "icon", onClick: () => downloadFile(this.message.link, { fallbackName: 'image' }) }, h("rtk-icon", { key: '53c7e551ec4a2efb32d60d16eb2a4a02144abf4f', icon: this.iconPack.download }))))))));
    }
};
__decorate$1([
    SyncWithStore()
], RtkImageMessage.prototype, "iconPack", void 0);
__decorate$1([
    SyncWithStore()
], RtkImageMessage.prototype, "t", void 0);
RtkImageMessage.style = rtkImageMessageCss();

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
const RtkTextMessage = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Date object of now, to calculate distance between dates */
        this.now = new Date();
        /** Whether the message is continued by same user */
        this.isContinued = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** show message in bubble */
        this.showBubble = false;
    }
    render() {
        return (h(Host, { key: 'a34dd007a87a134202e153f3d886102bbe6a685c' }, !this.isContinued && (h(ChatHead, { key: '8505cee0d359b7449776ece2bbd7455811217a41', name: this.message.displayName, time: this.message.time, now: this.now })), h("div", { key: '00b2baca454b62e4984e82790580bac116a046a0', class: {
                body: true,
                bubble: this.showBubble,
            }, part: "body" }, h("div", { key: 'ecc8de946011c9836cebfd626a27cb23f111d0cc', class: { text: true, emoji: hasOnlyEmojis(this.message.message) } }, h(TextMessageView, { key: '1efad576e6110986cb2abac7ff2c42b492c995aa', message: this.message.message })))));
    }
};
__decorate([
    SyncWithStore()
], RtkTextMessage.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkTextMessage.prototype, "t", void 0);

export { RtkFileMessage as rtk_file_message, RtkImageMessage as rtk_image_message, RtkTextMessage as rtk_text_message };

import { r as registerInstance, h, a as Host, d as createEvent, g as getElement, e as writeTask } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, c as createDefaultConfig, f as defaultOverrides, j as gracefulStorage, u as uiStore, b as createPeerStore } from './ui-store-CkvSNsmd.js';
import { f as formatName, g as getInitials, s as sanitizeLink, h as hasOnlyEmojis } from './string-vBD2htwQ.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { h as handleFilesDataTransfer, M as MAX_TEXT_LENGTH, p as parseRichText, e as extractReplyBlock, s as stripOutReplyBlock } from './chat-DRqOBXqN.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { g as getExtension, a as getFileSize, d as downloadFile } from './file-6Fkktc2w.js';
import { p as provideRtkDesignSystem, m as merge } from './merge-Bnx8tW3F.js';
import { R as Render } from './index-BUsisVB6.js';
import { g as generateConfig } from './config-BiYmSYD9.js';
import { i as index } from './ResizeObserver.es-FdeAvICb.js';
import { g as getInitErrorInfo } from './init-error-DE1s0fDa.js';
import { g as getJoinErrorInfo } from './join-error-vBfDtD_u.js';
import { c as computePosition, o as offset, f as flip, s as shift, a as arrow } from './floating-ui.dom-B1SWgSTZ.js';
import { f as formatDateTime, e as elapsedDuration } from './date-jvwnrxra.js';
import { d as debounce } from './debounce-BmgYF10w.js';
import './breakout-rooms-Daj_55_i.js';

const rtkAvatarCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;height:var(--rtk-space-32, 128px);width:var(--rtk-space-32, 128px);align-items:center;justify-content:center;font-size:28px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)));overflow:clip;border-radius:9999px;-webkit-user-select:none;-moz-user-select:none;user-select:none}rtk-icon{height:50%;width:50%}.image-ctr{display:flex;height:100%;width:100%;align-items:center;justify-content:center;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}img{height:var(--rtk-space-0, 0px);width:var(--rtk-space-0, 0px);-o-object-fit:cover;object-fit:cover}img.loaded{height:100%;width:100%}.initials{display:flex;height:100%;width:100%;align-items:center;justify-content:center;text-transform:uppercase}.image{display:flex;height:100%;width:100%;align-items:center;justify-content:center}.image img{display:none;height:100%;width:100%;-o-object-fit:cover;object-fit:cover}.image img.loaded{display:block}:host([variant='hexagon']){border-radius:var(--rtk-border-radius-none, 0);clip-path:polygon(50% 0, 95% 25%, 95% 75%, 50% 100%, 5% 75%, 5% 25%)}:host([variant='square']){border-radius:var(--rtk-border-radius-none, 0);clip-path:polygon(0% 0%, 100% 0%, 100% 100%, 0% 100%)}:host([size='sm']){height:var(--rtk-space-14, 56px);width:var(--rtk-space-14, 56px);font-size:12px}:host([size='md']){height:var(--rtk-space-28, 112px);width:var(--rtk-space-28, 112px)}:host([size='lg']){height:var(--rtk-space-32, 128px);width:var(--rtk-space-32, 128px)}`;

var __decorate$i = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkAvatar = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Avatar type */
        this.variant = 'circular';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.imageState = 'loading';
        this.getAvatar = () => {
            var _a;
            const name = formatName(((_a = this.participant) === null || _a === void 0 ? void 0 : _a.name) || '');
            let picture;
            if (this.participant != null && 'picture' in this.participant) {
                picture = this.participant.picture;
            }
            if (picture && picture.length > 0 && this.imageState !== 'errored') {
                return (h("div", { class: "image-ctr" }, this.imageState === 'loading' && h("rtk-spinner", { iconPack: this.iconPack }), h("img", { src: picture, class: { loaded: this.imageState === 'loaded' }, loading: "lazy", title: name, onLoad: () => (this.imageState = 'loaded'), onError: () => (this.imageState = 'errored'), part: "image" })));
            }
            const initials = getInitials(name);
            return (h("div", { class: "initials", title: name, part: "initials" }, initials));
        };
    }
    render() {
        return (h(Host, { key: 'd7d3a7b03a3807984dc6798b5e35cec4418e06e7' }, this.getAvatar(), h("slot", { key: '25aa9fe632a132c1e2f8ef88ac98043bb8ef085a' })));
    }
};
__decorate$i([
    SyncWithStore()
], RtkAvatar.prototype, "iconPack", void 0);
__decorate$i([
    SyncWithStore()
], RtkAvatar.prototype, "t", void 0);
RtkAvatar.style = rtkAvatarCss();

const rtkButtonCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{--icon-size:var(--rtk-button-icon-size, var(--rtk-space-5, 20px));--transition-property:var(--rtk-transition-property, all);--transition-duration:100ms;display:inline-flex;height:var(--rtk-space-8, 32px);cursor:pointer;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));font-size:14px;-webkit-user-select:none;-moz-user-select:none;user-select:none;border-radius:var(--rtk-border-radius-sm, 4px);transition-property:var(--transition-property);transition-duration:var(--transition-duration)}button{box-sizing:border-box;background-color:transparent;color:inherit;border:var(--rtk-border-width-sm, 1px) solid transparent;padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);display:inline-flex;flex-grow:1;justify-content:center;vertical-align:baseline;gap:var(--rtk-space-1, 4px);transition-property:var(--transition-property);transition-duration:var(--transition-duration);outline:none;height:inherit;border-radius:inherit;fill:inherit;cursor:inherit;font-weight:inherit;font-family:inherit;font-size:inherit;line-height:inherit}.start,.content,.end{align-self:center}::slotted(rtk-icon),::slotted(rtk-spinner){height:var(--icon-size);width:var(--icon-size)}:host([variant='primary']){color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)))}:host(:hover){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-bg-opacity))}button:focus-visible{border-color:rgb(var(--rtk-colors-text-1000, 255 255 255))}:host(:active){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-700, 2 70 253) / var(--tw-bg-opacity))}:host([disabled]:not([disabled='false'])){cursor:not-allowed;opacity:0.6}:host([variant='secondary']){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}:host([variant='secondary']:hover){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}:host([variant='secondary']:active){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}:host([variant='danger']){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-bg-opacity))}:host([variant='danger']:hover){background-color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.7)}:host([variant='danger']:active){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-bg-opacity))}:host([variant='ghost']){background-color:transparent;color:inherit}:host([variant='ghost'].active){--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity))}:host([variant='ghost']:hover){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}:host([variant='ghost']:active){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}:host([kind='icon']){--icon-size:var(--rtk-space-5, 20px);width:var(--rtk-space-8, 32px)}:host([kind='icon']) button{padding-left:var(--rtk-space-0, 0px);padding-right:var(--rtk-space-0, 0px)}:host([kind='wide']){width:100%}:host([size='lg']){--icon-size:var(--rtk-space-5, 20px);height:var(--rtk-space-10, 40px);font-size:16px}:host([size='lg'][kind='icon']){--icon-size:var(--rtk-space-6, 24px);height:var(--rtk-space-10, 40px);width:var(--rtk-space-10, 40px)}:host([size='sm']){--icon-size:var(--rtk-space-4, 16px);height:var(--rtk-space-6, 24px);font-size:12px}:host([size='sm'][kind='icon']){height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}`;

const RtkButton = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Button variant */
        this.variant = 'primary';
        /** Button type */
        this.kind = 'button';
        /** Whether to reverse order of children */
        this.reverse = false;
        /** Where the button is disabled or not */
        this.disabled = false;
        /** Button type */
        this.type = 'button';
    }
    render() {
        return (h(Host, { key: '0f96cef4ae77a2be8013fa5d62d39626734eeced' }, h("button", { key: '8c06d5f5cc71779b8d56f31d2dd77b8d35e8b280', part: "button", type: this.type, disabled: this.disabled }, h("span", { key: 'ae741ddf8cc914f9493c26330b1f322541f64223', class: "start" }, h("slot", { key: '18275dab42a4dd38b5a59463ffca227e4a6df3c8', name: "start" })), h("span", { key: 'c2b912515b6edc2966c4cdb282c89022aa05c13f', class: "content", part: "content" }, h("slot", { key: '5d87993198e16a3b5f38e62979fa2ee5637a059d' })), h("span", { key: '0bc907da23ea362f8ae0b3fdf88452b1c3881078', class: "end" }, h("slot", { key: '0862eeefcfa5765ce605b99a04aab88222ed6e68', name: "end" })))));
    }
    static get delegatesFocus() { return true; }
};
RtkButton.style = rtkButtonCss();

const rtkChatCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{display:flex;height:100%;width:100%;flex-direction:column;font-size:14px;position:relative;box-sizing:border-box;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}h3{margin:var(--rtk-space-0, 0px);display:flex;height:var(--rtk-space-12, 48px);align-items:center;justify-content:center;font-size:16px;font-weight:400;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));text-align:center}#dropzone{position:absolute;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);z-index:10;display:none;flex-direction:column;align-items:center;justify-content:center;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}#dropzone.active{display:flex;animation:0.2s slide-up ease-in}rtk-chat-messages-ui,rtk-chat-messages-ui-paginated{flex:1 0 0}rtk-chat-composer-view{margin:var(--rtk-space-2, 8px)}.chat-container{display:flex;height:100%;width:100%;flex-direction:row;container-type:size;container-name:chatcontainer}.chat{box-sizing:border-box;display:flex;flex:1 1 0%;flex-direction:column}.banner{height:100%;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center}.view-chats-btn{margin-top:var(--rtk-space-4, 16px)}.selector-container{z-index:50;width:100%;max-width:var(--rtk-space-80, 320px);border-right:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}.selector-container.hide{display:none}.mobile-close-btn{display:none}.selector-container.mobile{height:100%;width:100%;max-width:100%;position:absolute;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / 0.6);display:flex}.selector-container.mobile .mobile-close-btn{margin-top:var(--rtk-space-4, 16px);margin-bottom:var(--rtk-space-4, 16px);margin-left:var(--rtk-space-6, 24px);margin-right:var(--rtk-space-6, 24px);display:block}.pinned-messages{position:relative;display:flex;flex-direction:column}.pinned-messages-header{display:flex;align-items:center;justify-content:space-between;gap:var(--rtk-space-2, 8px);padding:var(--rtk-space-4, 16px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));font-size:14px;cursor:pointer}.pinned-messages-header div{display:flex;flex-direction:row;align-items:center;gap:var(--rtk-space-2, 8px)}.pinned-messages-header rtk-icon{height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px)}.pinned-messages-content{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));position:absolute;left:var(--rtk-space-0, 0px);top:100%;z-index:50;max-height:30vh;width:100%;overflow:auto}.pinned-message{display:flex;cursor:pointer;flex-direction:row;align-items:center;gap:var(--rtk-space-2, 8px);--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));padding:var(--rtk-space-4, 16px);border-bottom-width:var(--rtk-border-width-sm, 1px);border-right-width:var(--rtk-border-width-none, 0);border-left-width:var(--rtk-border-width-none, 0);border-top-width:var(--rtk-border-width-none, 0);border-style:solid}.pinned-message-avatar{height:var(--rtk-space-6, 24px) !important;width:var(--rtk-space-6, 24px) !important}@keyframes swipe-in{from{transform:translateX(-100%)}to{transform:translateX(0)}}`;

var __decorate$h = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkChat = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.chatPermissionUpdateListener = () => {
            this.canSend = this.meeting.self.permissions.chatPublic.canSend;
            this.canSendTextMessage = this.meeting.self.permissions.chatPublic.text;
            this.canSendFiles = this.meeting.self.permissions.chatPublic.files;
        };
        /** Config */
        this.config = createDefaultConfig();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** UI Overrides */
        this.overrides = defaultOverrides;
        /** Can current user pin/unpin messages */
        this.canPinMessages = false;
        this.now = new Date();
        this.dropzoneActivated = false;
        this.showLatestMessageButton = false;
        this.canSend = false;
        this.canSendTextMessage = false;
        this.canSendFiles = false;
        this.canPrivateMessage = false;
        this.canSendPrivateTexts = false;
        this.canSendPrivateFiles = false;
        this.emojiPickerEnabled = false;
        this.participants = [];
        this.selectedParticipant = null;
        this.editingMessage = null;
        this.replyMessage = null;
        this.searchQuery = '';
        this.selectorState = 'hide';
        this.isSendingMessage = false;
        this.showPinnedMessages = false;
        this.onDragOver = (e) => {
            e.preventDefault();
            this.dropzoneActivated = true;
        };
        this.onDragLeave = () => {
            this.dropzoneActivated = false;
        };
        this.onDrop = (e) => {
            e.preventDefault();
            this.dropzoneActivated = false;
            handleFilesDataTransfer(e.dataTransfer.items, (type, file) => {
                var _a, _b, _c, _d;
                switch (type) {
                    case 'image':
                        if (this.isFileMessagingAllowed()) {
                            (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.chat) === null || _b === void 0 ? void 0 : _b.sendImageMessage(file, this.getRecipientPeerIds());
                        }
                        break;
                    case 'file':
                        if (this.isFileMessagingAllowed()) {
                            (_d = (_c = this.meeting) === null || _c === void 0 ? void 0 : _c.chat) === null || _d === void 0 ? void 0 : _d.sendFileMessage(file, this.getRecipientPeerIds());
                        }
                        break;
                }
            });
        };
        this.disconnectMeeting = (meeting) => {
            meeting.self.permissions.removeListener('*', this.chatPermissionUpdateListener);
        };
        this.isTextMessagingAllowed = () => {
            if (!this.selectedParticipant) {
                // public chat
                return this.canSend && this.canSendTextMessage;
            }
            // private chat
            return this.canPrivateMessage && this.canSendPrivateTexts;
        };
        this.isFileMessagingAllowed = () => {
            if (!this.selectedParticipant) {
                // public chat
                return this.canSend && this.canSendFiles;
            }
            // private chat
            return this.canPrivateMessage && this.canSendPrivateFiles;
        };
        this.onQuotedMessageDismiss = () => {
            this.replyMessage = null;
        };
        this.onNewMessageHandler = async (e) => {
            const message = e.detail;
            this.isSendingMessage = true;
            try {
                await this.meeting.chat.sendMessage(message, this.getRecipientPeerIds());
            }
            finally {
                this.isSendingMessage = false;
            }
        };
        this.onEditMessageHandler = async (e) => {
            var _a, _b;
            this.isSendingMessage = true;
            try {
                await ((_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.chat) === null || _b === void 0 ? void 0 : _b.editTextMessage(this.editingMessage.id, e.detail));
            }
            finally {
                this.isSendingMessage = false;
                this.editingMessage = null;
            }
        };
        this.onEditCancel = () => {
            this.editingMessage = null;
        };
        this.onPinMessage = (event) => {
            const message = event.detail;
            if (message.pinned) {
                this.meeting.chat.unpin(message.id);
            }
            else {
                this.meeting.chat.pin(message.id);
            }
        };
        this.onDeleteMessage = (event) => {
            var _a;
            const message = event.detail;
            if (((_a = this.editingMessage) === null || _a === void 0 ? void 0 : _a.id) === message.id) {
                this.editingMessage = null;
            }
            try {
                if (typeof localStorage !== 'undefined') {
                    const keysToRemove = [];
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith('rtk-chat-edit-') && key.endsWith(`-${message.id}`)) {
                            keysToRemove.push(key);
                        }
                    }
                    keysToRemove.forEach((key) => localStorage.removeItem(key));
                }
            }
            catch (_b) {
                // ignore storage access errors
            }
            this.meeting.chat.deleteMessage(message.id);
        };
        this.onMessageEdit = (event) => {
            const message = event.detail;
            if (message.type !== 'text')
                return;
            this.replyMessage = null;
            this.editingMessage = message;
        };
    }
    connectedCallback() {
        if (!this.meeting)
            return;
        this.meetingChanged(this.meeting);
        if (this.meeting && !this.meeting.chat) {
            return;
        }
        if (this.isFileMessagingAllowed()) {
            this.host.addEventListener('dragover', this.onDragOver);
            this.host.addEventListener('dragleave', this.onDragLeave);
            this.host.addEventListener('drop', this.onDrop);
        }
    }
    onEditMessageInit(event) {
        if (event.detail.flags.isReply) {
            this.replyMessage = event.detail.payload;
        }
        else if (event.detail.flags.isEdit) {
            this.editingMessage = event.detail.payload;
        }
    }
    onChatSelectorChange(event) {
        var _a;
        const selectedUser = (_a = event.detail) === null || _a === void 0 ? void 0 : _a.selectedUser;
        // Everyone
        if (!selectedUser) {
            this.selectedParticipant = null;
            return;
        }
        this.selectedParticipant = selectedUser;
    }
    disconnectedCallback() {
        var _a;
        (_a = this.resizeObserver) === null || _a === void 0 ? void 0 : _a.disconnect();
        this.disconnectMeeting(this.meeting);
        this.host.removeEventListener('dragover', this.onDragOver);
        this.host.removeEventListener('dragleave', this.onDragLeave);
        this.host.removeEventListener('drop', this.onDrop);
    }
    meetingChanged(meeting, oldMeeting) {
        var _a, _b, _c, _d;
        if (oldMeeting != undefined)
            this.disconnectMeeting(oldMeeting);
        if (meeting && !meeting.chat)
            return;
        if (meeting != null) {
            this.canSend = meeting.self.permissions.chatPublic.canSend;
            this.canSendTextMessage = meeting.self.permissions.chatPublic.text;
            this.canSendFiles = meeting.self.permissions.chatPublic.files;
            this.canPrivateMessage = !!(((_a = meeting.self.permissions.chatPrivate) === null || _a === void 0 ? void 0 : _a.canSend) ||
                ((_b = meeting.self.permissions.chatPrivate) === null || _b === void 0 ? void 0 : _b.canReceive));
            this.canSendPrivateTexts = !!((_c = meeting.self.permissions.chatPrivate) === null || _c === void 0 ? void 0 : _c.text);
            this.canSendPrivateFiles = !!((_d = meeting.self.permissions.chatPrivate) === null || _d === void 0 ? void 0 : _d.files);
            meeting.self.permissions.on('*', this.chatPermissionUpdateListener);
        }
    }
    getRecipientPeerIds() {
        if (!this.selectedParticipant)
            return [];
        return [this.selectedParticipant.id];
    }
    renderComposerUI() {
        if (!this.selectedParticipant) {
            if (!this.canSendTextMessage && !this.canSendFiles)
                return null;
        }
        else {
            if (!this.canSendPrivateTexts && !this.canSendPrivateFiles)
                return null;
        }
        const uiProps = { iconPack: this.iconPack, t: this.t, size: this.size };
        const message = this.editingMessage ? this.editingMessage.message : '';
        const quotedMessage = this.replyMessage ? this.replyMessage.message : '';
        const draftStorageKey = 'rtk-chat-draft';
        const editStorageKey = this.editingMessage
            ? `rtk-chat-edit-${'no-channel'}-${this.editingMessage.id}`
            : 'rtk-chat-edit';
        const storageKey = this.editingMessage ? editStorageKey : draftStorageKey;
        return (h("rtk-chat-composer-view", Object.assign({ message: message, storageKey: storageKey, quotedMessage: quotedMessage, isEditing: !!this.editingMessage, isSending: this.isSendingMessage, canSendTextMessage: this.isTextMessagingAllowed(), canSendFiles: this.isFileMessagingAllowed(), disableEmojiPicker: this.overrides.disableEmojiPicker, maxLength: this.meeting.chat.maxTextLimit, rateLimits: this.meeting.chat.rateLimits, inputTextPlaceholder: this.t('chat.message_placeholder'), onNewMessage: this.onNewMessageHandler, onEditMessage: this.onEditMessageHandler, onEditCancel: this.onEditCancel, onQuotedMessageDismiss: this.onQuotedMessageDismiss }, uiProps), h("slot", { name: "chat-addon", slot: "chat-addon" })));
    }
    render() {
        if (!this.meeting) {
            return null;
        }
        return (h(Host, null, h("div", { class: "chat-container" }, h("div", { class: "chat" }, this.isFileMessagingAllowed() && (h("div", { id: "dropzone", class: { active: this.dropzoneActivated }, part: "dropzone" }, h("rtk-icon", { icon: this.iconPack.attach }), h("p", null, this.t('chat.send_attachment')))), h("rtk-chat-header", null), h("rtk-chat-messages-ui-paginated", { meeting: this.meeting, privateChatRecipient: this.selectedParticipant, onPinMessage: this.onPinMessage, onEditMessage: this.onMessageEdit, onDeleteMessage: this.onDeleteMessage, size: this.size, iconPack: this.iconPack, t: this.t }), this.renderComposerUI()))));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$h([
    SyncWithStore()
], RtkChat.prototype, "meeting", void 0);
__decorate$h([
    SyncWithStore()
], RtkChat.prototype, "config", void 0);
__decorate$h([
    SyncWithStore()
], RtkChat.prototype, "iconPack", void 0);
__decorate$h([
    SyncWithStore()
], RtkChat.prototype, "t", void 0);
__decorate$h([
    SyncWithStore()
], RtkChat.prototype, "overrides", void 0);
RtkChat.style = rtkChatCss();

const rtkChatComposerViewCss = () => `:host{display:flex;flex-direction:column;font-family:var(--rtk-font-family, sans-serif);font-size:14px;position:relative}.quoted-message-container{margin-bottom:var(--rtk-space-2, 8px);display:flex;justify-content:space-between;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));border-radius:var(--rtk-border-radius-md, 8px);border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}.quoted-message-container .quoted-message{flex:1 1 0%;padding:var(--rtk-space-2, 8px);border-radius:var(--rtk-border-radius-md, 8px);max-height:var(--rtk-space-24, 96px);overflow-y:auto;word-break:break-all}.quoted-message-container .quoted-message blockquote{display:none}.quoted-message-container rtk-icon.dismiss{margin-left:auto;height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);padding:var(--rtk-space-2, 8px);border-radius:var(--rtk-border-radius-md, 8px);color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.quoted-message-container rtk-icon.dismiss:hover{cursor:pointer;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.quoted-message-container rtk-icon.dismiss{transition-property:color, background-color, border-color, text-decoration-color, fill, stroke;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms}.composer-container{position:relative;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));border-radius:var(--rtk-border-radius-md, 8px);overflow:hidden;border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}.composer-container>.composers{min-height:60px}@container chatcontainer (height < 360px){.composer-container>.composers{min-height:30px}}.chat-buttons{padding:var(--rtk-space-3, 12px);display:flex;align-items:center;justify-content:space-between;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-buttons .right{z-index:10}.chat-buttons .right .edit-buttons{display:flex;gap:var(--rtk-space-2, 8px)}.chat-buttons>div{display:flex;align-items:center}rtk-emoji-picker{z-index:20;position:absolute;top:calc(var(--rtk-space-72, 288px) * -1);border-top:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60));animation:0.3s slide-up ease}@keyframes slide-up{from{transform:translateY(100%)}to{transform:translateY(0%)}}`;

var __decorate$g = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const messageLimits = {
    messagesSent: 0,
    startTime: 0,
};
const RtkChatComposerView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onNewMessage = createEvent(this, "newMessage", 7);
        this.onEditMessage = createEvent(this, "editMessage", 7);
        this.onEditCancel = createEvent(this, "editCancel", 7);
        this.onQuotedMessageDismiss = createEvent(this, "quotedMessageDismiss", 7);
        /** Whether user can send text messages */
        this.canSendTextMessage = true;
        this.isSending = false;
        /** Whether user can send file messages */
        this.canSendFiles = true;
        /** Message to be pre-populated */
        this.message = '';
        /** Quote message to be displayed */
        this.quotedMessage = '';
        /** Key for storing message in localStorage */
        this.storageKey = 'rtk-text-message';
        /** Placeholder for text input */
        this.inputTextPlaceholder = 'Enter your message';
        /** Sets composer to edit mode */
        this.isEditing = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Whether to show emoji picker */
        this.disableEmojiPicker = false;
        /** Rate limits */
        this.rateLimits = {
            period: 60,
            maxInvocations: 60,
        };
        this.fileToUpload = null;
        this.isEmojiPickerOpen = false;
        this.disableSendButton = false;
        this.rateLimitsBreached = false;
        this.textMessage = '';
        this.sendFile = () => {
            if (!this.canSendFiles) {
                return;
            }
            if (this.fileToUpload.type === 'image') {
                this.onNewMessage.emit({
                    type: 'image',
                    image: this.fileToUpload.file,
                });
            }
            else {
                this.onNewMessage.emit({ type: 'file', file: this.fileToUpload.file });
            }
            this.fileToUpload = null;
        };
        this.handleSendMessage = () => {
            if (!this.canSendTextMessage || this.rateLimitsBreached) {
                return;
            }
            if (this.fileToUpload !== null) {
                this.sendFile();
                return;
            }
            const message = this.textMessage;
            const currentTime = Date.now();
            if (currentTime - messageLimits.startTime > this.rateLimits.period * 1000) {
                messageLimits.startTime = currentTime;
                messageLimits.messagesSent = 0;
            }
            messageLimits.messagesSent += 1;
            this.checkRateLimitBreached(currentTime);
            if (message.length > 0) {
                this.onNewMessage.emit({ type: 'text', message });
                this.cleanup();
            }
        };
        this.handleEditMessage = () => {
            this.onEditMessage.emit(this.textMessage);
            this.cleanup();
        };
        this.handleEditCancel = () => {
            this.onEditCancel.emit();
            this.cleanup();
        };
        this.onTextChangeHandler = (event) => {
            var _a;
            this.textMessage = event.detail;
            if (this.textMessage.length >= ((_a = this.maxLength) !== null && _a !== void 0 ? _a : MAX_TEXT_LENGTH)) {
                this.disableSendButton = true;
            }
            else if (this.disableSendButton) {
                this.disableSendButton = false;
            }
            gracefulStorage.setItem(this.storageKey, event.detail);
        };
        this.onKeyDownHandler = (event) => {
            if (event.key === 'Enter' && event.shiftKey) {
                return;
            }
            if (this.disableSendButton) {
                return;
            }
            if (event.key === 'Enter') {
                event.preventDefault();
                if (this.isEditing) {
                    this.handleEditMessage();
                }
                else {
                    this.handleSendMessage();
                }
            }
        };
        this.onFileUploadHandler = (type, file) => {
            this.fileToUpload = { type, file };
        };
        this.onQuotedMessageDismissHandler = () => {
            this.onQuotedMessageDismiss.emit();
        };
        this.cleanup = () => {
            this.textMessage = '';
            this.fileToUpload = null;
            gracefulStorage.setItem(this.storageKey, '');
            this.$textComposer.setText('', true);
            this.isEmojiPickerOpen = false;
        };
        this.onKeyDownHandler = this.onKeyDownHandler.bind(this);
    }
    connectedCallback() {
        this.textMessage = this.message || gracefulStorage.getItem(this.storageKey) || '';
        this.checkRateLimitBreached(Date.now());
    }
    componentWillUpdate() {
        this.textMessage = this.message || gracefulStorage.getItem(this.storageKey) || '';
    }
    componentDidLoad() {
        if (this.message) {
            writeTask(() => this.$textComposer.setText(this.message, true));
        }
    }
    checkRateLimitBreached(currentTime) {
        // Check if the function call is within limits
        if (messageLimits.messagesSent >= this.rateLimits.maxInvocations) {
            this.disableSendButton = true;
            this.rateLimitsBreached = true;
            const timeRemainingForReset = currentTime - messageLimits.startTime + this.rateLimits.period * 1000;
            setTimeout(() => {
                messageLimits.messagesSent = 0;
                messageLimits.startTime = Date.now();
                this.disableSendButton = false;
                this.rateLimitsBreached = false;
            }, timeRemainingForReset);
        }
    }
    render() {
        var _a;
        const uiProps = { iconPack: this.iconPack, t: this.t };
        return (h(Host, { key: '2df23422579c855ced1cb6d24bb95786a1326baf' }, this.canSendTextMessage && this.isEmojiPickerOpen && (h("rtk-emoji-picker", Object.assign({ key: 'a7ed280a636d0207f58f0ad13f79c1eaed52ab9c', part: "emoji-picker", onPickerClose: () => {
                this.isEmojiPickerOpen = false;
            }, onRtkEmojiClicked: (e) => {
                this.textMessage += e.detail;
                this.$textComposer.setText(this.textMessage, true);
            } }, uiProps))), h("slot", { key: '759df2a2029fbba963cfc26cd871771881dd6c5e', name: "chat-addon" }), this.quotedMessage && this.quotedMessage.length !== 0 && (h("div", { key: '413be05a7374fc76f790ad3f6f5bef5a56a6ef97', class: "quoted-message-container", part: "quoted-message-container" }, h("div", { key: '7fb6b571103c675dca202b74bd07fd55062dab70', class: "quoted-message scrollbar" }, h("rtk-text-message-view", { key: '3997aa719a746234c5641e976dd0c27e68b69dae', text: this.quotedMessage, isMarkdown: true })), h("div", { key: 'f76ec54e3d67d6957d5d152b144b22d8cc122660' }, h("rtk-icon", { key: '897b52fc41814d2cb8beeb461c36c9843cb2869e', "aria-label": this.t('dismiss'), class: "dismiss", icon: this.iconPack.dismiss, onClick: this.onQuotedMessageDismissHandler })))), h("div", { key: '35447eb1fffffd372c231bc76ce741e483e7f26a', class: "composer-container" }, h("div", { key: '0f8f198df49fcc27f6c85b8d6909eb2a7c00e142', class: "composers" }, this.fileToUpload && (h("rtk-draft-attachment-view", Object.assign({ key: '9d325d05fecb12ecb41f02e54561d2e1b59b2c2f' }, uiProps, { attachment: this.fileToUpload, onDeleteAttachment: () => (this.fileToUpload = null) }))), !this.fileToUpload && (h("rtk-text-composer-view", { key: 'fbc870bb9d9c2418e528e64273edb67846e23e17', value: this.textMessage, placeholder: this.inputTextPlaceholder, onTextChange: this.onTextChangeHandler, keyDownHandler: this.onKeyDownHandler, maxLength: (_a = this.maxLength) !== null && _a !== void 0 ? _a : MAX_TEXT_LENGTH, rateLimitBreached: this.rateLimitsBreached, t: this.t, iconPack: this.iconPack, ref: (el) => (this.$textComposer = el) }))), h("div", { key: '20191403531eb87bca86d13387c7937153a4c99e', class: "chat-buttons", part: "chat-buttons" }, h("div", { key: '4914a61fea3f502dc14778a237e9ce35a97e3afc', class: "left", part: "chat-buttons-left" }, !this.fileToUpload && !this.isEditing && (h("div", { key: '76c843588f2f7d90f5e60a1e44955309026eda27' }, this.canSendFiles && [
            h("rtk-file-picker-button", Object.assign({ key: 'cbb6f17b22f10b48ada27a4b4da3c1d5b2c7e320' }, uiProps, { onFileChange: (event) => this.onFileUploadHandler('file', event.detail) })),
            h("rtk-file-picker-button", Object.assign({ key: '0868162a2da021dd4175e977adf47d72ca54044a', filter: "image/*", label: this.t('chat.send_img'), icon: "image", onFileChange: (event) => this.onFileUploadHandler('image', event.detail) }, uiProps)),
        ], this.canSendTextMessage && !this.disableEmojiPicker && (h("rtk-emoji-picker-button", Object.assign({ key: 'a73378b5495dc3bfcde7dba335f674292ee6a96c', isActive: this.isEmojiPickerOpen, onClick: () => {
                this.isEmojiPickerOpen = !this.isEmojiPickerOpen;
            } }, uiProps))), h("slot", { key: '31208ad279dec430da4527d22730de8e418bc722', name: "chat-buttons" })))), h("div", { key: '04fcdd3f690548cbf1e257ffb2982785e557726b', class: "right", part: "chat-buttons-right" }, !this.isEditing && (h("rtk-tooltip", { key: '367bf710673a0a2276f46d52289409abb77fe27b', variant: "primary", label: this.t('chat.send_msg'), delay: 2000 }, h("rtk-button", { key: 'c677e3026636c375ed7eee411c596f6d2a802794', kind: "icon", disabled: this.disableSendButton || this.isSending, onClick: () => this.handleSendMessage(), title: this.t('chat.send_msg') }, this.isSending ? (h("rtk-spinner", { size: "sm" })) : (h("rtk-icon", { icon: this.iconPack.send }))))), this.isEditing && (h("div", { key: '1e09e8868e4ae048b36bc8198b8aa1de92209a00', class: "edit-buttons" }, h("rtk-tooltip", { key: '29ff7a39bd168169fa7d104357b529a2c9efe0fd', variant: "secondary", label: this.t('cancel'), delay: 2000 }, h("rtk-button", { key: '27cf5353d0e8c2620fd8d4213994a9dcc83f83f3', kind: "icon", variant: "secondary", onClick: () => this.handleEditCancel(), title: this.t('cancel') }, h("rtk-icon", { key: 'aeb4c9df3993c6cebf952f64f6676eb8a3866bb0', icon: this.iconPack.dismiss }))), h("rtk-tooltip", { key: '835195d0f51a1db81e66a1b2d9076a71f2aaee4e', variant: "primary", label: this.t('chat.update_msg'), delay: 2000 }, h("rtk-button", { key: 'd524f01ba5d7ca52224d39e23e7f963972ad80c9', kind: "icon", onClick: () => this.handleEditMessage(), title: this.t('chat.send_msg') }, this.isSending ? (h("rtk-spinner", { size: "sm" })) : (h("rtk-icon", { icon: this.iconPack.checkmark })))))))))));
    }
};
__decorate$g([
    SyncWithStore()
], RtkChatComposerView.prototype, "iconPack", void 0);
__decorate$g([
    SyncWithStore()
], RtkChatComposerView.prototype, "t", void 0);
RtkChatComposerView.style = rtkChatComposerViewCss();

const rtkChatHeaderCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{display:flex;width:100%;flex-direction:column;gap:var(--rtk-space-2, 8px);font-size:14px;z-index:10;margin-bottom:var(--rtk-space-2, 8px);box-sizing:border-box;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-header{position:relative;margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);gap:var(--rtk-space-2, 8px);padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);display:flex;flex-direction:row;align-items:center;justify-content:space-between;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));border-radius:var(--rtk-border-radius-sm, 4px);overflow:hidden;border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60));cursor:pointer}.chat-header-label{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px)}`;

const RtkChatHeader = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onPinnedToggle = async (e) => {
            var _a, _b, _c;
            if ((_a = e.detail) === null || _a === void 0 ? void 0 : _a.open) {
                await ((_c = (_b = this.$chatSelector) === null || _b === void 0 ? void 0 : _b.close) === null || _c === void 0 ? void 0 : _c.call(_b));
            }
        };
        this.onChatToggle = async (e) => {
            var _a, _b, _c;
            if ((_a = e.detail) === null || _a === void 0 ? void 0 : _a.open) {
                await ((_c = (_b = this.$pinnedSelector) === null || _b === void 0 ? void 0 : _b.close) === null || _c === void 0 ? void 0 : _c.call(_b));
            }
        };
    }
    render() {
        return (h(Host, { key: '3cec93546dc5c7eec01df7b1b1a3847a6f004f0d' }, h("rtk-pinned-message-selector", { key: 'f099b29e1fb773bfb2931bec2358dd15819778ce', ref: (el) => (this.$pinnedSelector = el), onRtkDropdownToggle: this.onPinnedToggle }), h("rtk-chat-selector", { key: '0d33e69cf161381dc7598de279147ec9035ef8d7', ref: (el) => (this.$chatSelector = el), onRtkDropdownToggle: this.onChatToggle })));
    }
};
RtkChatHeader.style = rtkChatHeaderCss();

const rtkChatMessagesUiPaginatedCss = () => `:host{display:flex;flex-direction:column;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));flex:1 0 0px}`;

var __decorate$f = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkChatMessagesUiPaginated = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.editMessageInit = createEvent(this, "editMessageInit", 7);
        this.onPinMessage = createEvent(this, "pinMessage", 7);
        this.onEditMessage = createEvent(this, "editMessage", 7);
        this.onDeleteMessage = createEvent(this, "deleteMessage", 7);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.permissionsChanged = false;
        this.pageSize = 25;
        this.permissionsUpdateListener = () => {
            this.permissionsChanged = !this.permissionsChanged;
        };
        this.getChatMessages = async (timestamp, size, reversed) => {
            if (this.privateChatRecipient) {
                try {
                    const messages = await this.meeting.chat.fetchPrivateMessages({
                        timestamp,
                        limit: size,
                        direction: reversed ? 'before' : 'after',
                        userId: this.privateChatRecipient.userId,
                    });
                    return messages;
                }
                catch (err) {
                    return [];
                }
            }
            try {
                const messages = await this.meeting.chat.fetchPublicMessages({
                    timestamp,
                    limit: size,
                    direction: reversed ? 'before' : 'after',
                });
                return messages;
            }
            catch (err) {
                return [];
            }
        };
        this.createChatNodes = (data) => {
            /**
             * NOTE(callmetarush): When between pages the message's isContinued
             * will fail in current implementation
             */
            return data.map((message, idx) => {
                var _a, _b;
                const isContinued = message.userId === ((_a = data[idx - 1]) === null || _a === void 0 ? void 0 : _a.userId);
                // FIXME(ikabra): Socket sends private messages sent to the recipient as a part of public messages
                if (!this.privateChatRecipient && ((_b = message.targetUserIds) === null || _b === void 0 ? void 0 : _b.length) > 0)
                    return;
                return this.createChatNode(message, isContinued);
            });
        };
        this.disconnectMeeting = (meeting) => {
            var _a, _b;
            (_a = meeting === null || meeting === void 0 ? void 0 : meeting.chat) === null || _a === void 0 ? void 0 : _a.removeListener('chatUpdate', this.chatUpdateListener);
            (_b = this.meeting) === null || _b === void 0 ? void 0 : _b.self.permissions.removeListener('permissionsUpdate', this.permissionsUpdateListener);
        };
        this.getMessageActions = (message) => {
            var _a;
            const actions = [];
            const messageBelongsToSelf = message.userId === this.meeting.self.userId;
            const isPrivateMessage = ((_a = message.targetUserIds) === null || _a === void 0 ? void 0 : _a.length) > 0;
            if (!isPrivateMessage) {
                actions.push({
                    id: 'pin_message',
                    label: message.pinned ? this.t('unpin') : this.t('pin'),
                    icon: this.iconPack.pin,
                });
            }
            if (messageBelongsToSelf) {
                actions.push({
                    id: 'edit_message',
                    label: this.t('chat.edit_msg'),
                    icon: this.iconPack.edit,
                });
                actions.push({
                    id: 'delete_message',
                    label: this.t('chat.delete_msg'),
                    icon: this.iconPack.delete,
                });
            }
            return actions;
        };
        this.onMessageActionHandler = (actionId, message) => {
            switch (actionId) {
                case 'pin_message':
                    this.onPinMessage.emit(message);
                    break;
                case 'edit_message':
                    this.onEditMessage.emit(message);
                    break;
                case 'delete_message':
                    this.onDeleteMessage.emit(message);
                    break;
            }
        };
        this.createChatNode = (message, isContinued) => {
            var _a, _b, _c, _d;
            let displayPicture;
            if (this.meeting.meta.viewType === 'CHAT') {
                displayPicture = (_a = this.meeting.participants.all
                    .toArray()
                    .find((p) => p.userId === message.userId)) === null || _a === void 0 ? void 0 : _a.picture;
            }
            else {
                if (this.meeting.self.userId === message.userId) {
                    displayPicture = this.meeting.self.picture;
                }
                else {
                    displayPicture =
                        (_c = (_b = this.meeting.participants.joined
                            .toArray()
                            .find((member) => member.userId === message.userId)) === null || _b === void 0 ? void 0 : _b.picture) !== null && _c !== void 0 ? _c : (_d = this.meeting.participants.waitlisted.toArray().find((p) => p.userId === message.userId)) === null || _d === void 0 ? void 0 : _d.picture;
                }
            }
            const isSelf = message.userId === this.meeting.self.userId;
            const viewType = isSelf ? 'outgoing' : 'incoming';
            return (h("div", null, h("div", { class: "message-wrapper", id: message.id }, h("rtk-message-view", { messageType: message.type, pinned: message.pinned, isEdited: message.isEdited, time: message.time, actions: this.getMessageActions(message), authorName: message.displayName, isSelf: isSelf, avatarUrl: displayPicture, hideAuthorName: isContinued, viewType: viewType, variant: "bubble", onAction: (event) => this.onMessageActionHandler(event.detail, message) }, h("div", null, h("div", { class: "body" }, message.type === 'text' && (h("rtk-text-message-view", { text: message.message, isMarkdown: true })), message.type === 'file' && (h("rtk-file-message-view", { name: message.name, url: message.link, size: message.size })), message.type === 'image' && (h("rtk-image-message-view", { url: message.link, onPreview: () => {
                    this.stateUpdate.emit({ image: message });
                } }))))))));
        };
        this.chatUpdateListener = (data) => {
            var _a, _b, _c;
            // if private message and not for privateChatRecipient, ignore
            // if private message and public chat selected, ignore
            if (((_a = data.message.targetUserIds) === null || _a === void 0 ? void 0 : _a.length) > 0 &&
                !data.message.targetUserIds.includes((_b = this.privateChatRecipient) === null || _b === void 0 ? void 0 : _b.userId))
                return;
            // if public message and private chat selected, ignore
            if (this.privateChatRecipient && ((_c = data.message.targetUserIds) === null || _c === void 0 ? void 0 : _c.length) === 0) {
                return;
            }
            if (data.action === 'add') {
                this.$paginatedListRef.onNewNode(data.message);
            }
            else if (data.action === 'delete') {
                this.$paginatedListRef.onNodeDelete(data.message.id);
            }
            else if (data.action === 'edit') {
                this.$paginatedListRef.onNodeUpdate(data.message.id, data.message);
            }
        };
    }
    componentDidLoad() {
        const slotted = this.host.shadowRoot.querySelector('slot');
        if (!slotted)
            return;
        this.children = slotted.assignedElements()[0];
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    async onPinnedMessageSelect(event) {
        var _a, _b;
        const message = event.detail;
        if (!message)
            return;
        await ((_b = (_a = this.$paginatedListRef) === null || _a === void 0 ? void 0 : _a.reset) === null || _b === void 0 ? void 0 : _b.call(_a, message.timeMs + 1));
    }
    disconnectedCallback() {
        this.disconnectMeeting(this.meeting);
    }
    privateChatRecipientChanged() {
        var _a;
        (_a = this.$paginatedListRef) === null || _a === void 0 ? void 0 : _a.reset();
    }
    meetingChanged(meeting, oldMeeting) {
        var _a;
        if (oldMeeting != undefined)
            this.disconnectMeeting(oldMeeting);
        if (meeting && !meeting.chat)
            return;
        if (meeting != null) {
            (_a = meeting.chat) === null || _a === void 0 ? void 0 : _a.addListener('chatUpdate', this.chatUpdateListener);
            meeting.self.permissions.addListener('permissionsUpdate', this.permissionsUpdateListener);
        }
        this.permissionsUpdateListener();
    }
    render() {
        return (h(Host, { key: '8862788879d34ba9474f6970251df29c4ac2064d' }, h("rtk-paginated-list", { key: 'cb0965c8bc5118408e943872b04d9fa7b6b9c970', ref: (el) => (this.$paginatedListRef = el), pageSize: this.pageSize, pagesAllowed: 3, fetchData: this.getChatMessages, createNodes: this.createChatNodes, emptyListLabel: this.t('chat.empty_chat') }, h("slot", { key: '7b1686d75404515a2bc018b9e40918612b826136' }))));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "privateChatRecipient": [{
                "privateChatRecipientChanged": 0
            }],
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$f([
    SyncWithStore()
], RtkChatMessagesUiPaginated.prototype, "meeting", void 0);
__decorate$f([
    SyncWithStore()
], RtkChatMessagesUiPaginated.prototype, "iconPack", void 0);
__decorate$f([
    SyncWithStore()
], RtkChatMessagesUiPaginated.prototype, "t", void 0);
RtkChatMessagesUiPaginated.style = rtkChatMessagesUiPaginatedCss();

const rtkChatSelectorCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{display:flex;width:100%;flex-direction:column;font-size:14px;position:relative;box-sizing:border-box;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-header{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);gap:var(--rtk-space-2, 8px);padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);display:flex;flex-direction:row;align-items:center;justify-content:space-between;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));cursor:pointer;border-radius:var(--rtk-border-radius-sm, 4px);border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}.chat-header-label{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px)}.dropdown{position:absolute;top:100%;z-index:10;padding:var(--rtk-space-0, 0px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));opacity:0;pointer-events:none;border-bottom-right-radius:var(--rtk-border-radius-sm, 4px);border-bottom-left-radius:var(--rtk-border-radius-sm, 4px);left:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);max-width:calc(100vw - var(--rtk-space-4, 16px));box-sizing:border-box}.dropdown.open{opacity:1;pointer-events:auto;border-width:1px;border-top-width:var(--rtk-border-width-none, 0);border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity))}.dropdown rtk-paginated-list{box-sizing:border-box;display:flex;height:30vh;flex-direction:column}.public-chat-group-label{display:flex;cursor:pointer;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px);border-left-width:var(--rtk-border-width-none, 0);border-right-width:var(--rtk-border-width-none, 0);border-top-width:var(--rtk-border-width-none, 0);border-bottom-width:var(--rtk-border-width-none, 0);border-bottom-width:1px;border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));padding-top:var(--rtk-space-4, 16px);padding-bottom:var(--rtk-space-4, 16px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px)}.public-chat-icon{display:flex;align-items:center;justify-content:center;padding:var(--rtk-space-1, 4px);border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity))}.public-chat-icon rtk-icon{color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)))}`;

var __decorate$e = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkChatSelector = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.dropdownToggle = createEvent(this, "rtkDropdownToggle", 7);
        this.chatSelectorChange = createEvent(this, "rtkChatSelectorChange", 7);
        /** Config */
        this.config = createDefaultConfig();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** UI Overrides */
        this.overrides = defaultOverrides;
        this.isOpen = false;
        this.showPrivateChat = false;
        this.selectedUser = undefined;
        //NOTE(ikabra): Fix this value once backend supports pagination for participants
        this.pageSize = 100000;
        this.pagesAllowed = 3;
        this.unreadMap = new Map();
        this.disconnectMeeting = (meeting) => {
            var _a, _b, _c, _d;
            const { self, participants } = meeting || {};
            (_a = meeting.chat) === null || _a === void 0 ? void 0 : _a.off('chatUpdate', this.chatUpdateListener);
            (_b = self === null || self === void 0 ? void 0 : self.permissions) === null || _b === void 0 ? void 0 : _b.off('*', this.chatPermissionUpdateListener);
            (_c = participants === null || participants === void 0 ? void 0 : participants.joined) === null || _c === void 0 ? void 0 : _c.off('participantJoined', this.participantJoinedListener);
            (_d = participants === null || participants === void 0 ? void 0 : participants.joined) === null || _d === void 0 ? void 0 : _d.off('participantLeft', this.participantLeftListener);
        };
        this.toggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            this.dropdownToggle.emit({ open: this.isOpen });
        };
        this.selectUser = async (user) => {
            if (user === null || user === void 0 ? void 0 : user.userId) {
                this.unreadMap.set(user.userId, false);
                this.$paginatedListRef.rerenderList();
            }
            this.selectedUser = user;
            this.chatSelectorChange.emit({ selectedUser: user });
            await this.close();
        };
        this.chatPermissionUpdateListener = () => {
            var _a, _b;
            this.showPrivateChat = !!(((_a = this.meeting.self.permissions.chatPrivate) === null || _a === void 0 ? void 0 : _a.canSend) ||
                ((_b = this.meeting.self.permissions.chatPrivate) === null || _b === void 0 ? void 0 : _b.canReceive));
            if (!this.showPrivateChat) {
                this.selectedUser = undefined;
                this.chatSelectorChange.emit({ selectedUser: undefined });
            }
        };
        this.onParticipantUpdate = () => {
            var _a, _b, _c, _d;
            if (!this.selectedUser)
                return;
            const participants = ((_d = (_c = (_b = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.participants) === null || _b === void 0 ? void 0 : _b.joined) === null || _c === void 0 ? void 0 : _c.toArray) === null || _d === void 0 ? void 0 : _d.call(_c)) || [];
            if (!participants.some((p) => { var _a; return p.id === ((_a = this.selectedUser) === null || _a === void 0 ? void 0 : _a.id); })) {
                this.selectedUser = undefined;
                this.chatSelectorChange.emit({ selectedUser: undefined });
            }
        };
        this.participantJoinedListener = (data) => {
            this.$paginatedListRef.onNewNode(data);
        };
        this.participantLeftListener = (data) => {
            this.$paginatedListRef.onNodeDelete(data.id);
            this.onParticipantUpdate();
        };
        // @ts-ignore - unused params
        this.getParticipants = async (timestamp, size, reversed) => {
            const meeting = this.meeting;
            if (!meeting)
                return [];
            /**
             * FIXME(ikabra): This is a temporary hack in place to handle the initial load
             * and not repeat participants when a user reaches the top of the list.
             * This must be replaced by actual pagination APIs from backend for participants.
             */
            if (!timestamp)
                return [];
            const participants = meeting.participants.joined.toArray();
            return participants;
        };
        this.createPaticipantNodes = (data) => {
            return data.map((participant) => {
                var _a;
                return (h("div", { class: "private-chat-label", id: participant.id, onClick: () => this.selectUser(participant) }, h("rtk-avatar", { size: "sm", participant: participant }), h("span", null, (_a = participant.name) !== null && _a !== void 0 ? _a : this.t('participant')), this.unreadMap.get(participant.userId) ? (h("div", { class: "private-chat-unread-badge" })) : null));
            });
        };
        this.chatUpdateListener = (data) => {
            var _a;
            if (data.action !== 'add')
                return;
            if (!((_a = data.message.targetUserIds) === null || _a === void 0 ? void 0 : _a.length))
                return;
            const selfUserId = this.meeting.self.userId;
            const otherUserId = data.message.targetUserIds.find((id) => id !== selfUserId);
            if (!otherUserId)
                return;
            this.unreadMap.set(otherUserId, true);
            this.$paginatedListRef.rerenderList();
        };
    }
    /** */
    async close() {
        if (!this.isOpen)
            return;
        this.isOpen = false;
        this.dropdownToggle.emit({ open: false });
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
        this.overridesChanged(this.overrides);
    }
    disconnectedCallback() {
        var _a, _b, _c;
        if (!this.meeting)
            return;
        const { self, participants } = this.meeting;
        (_a = self === null || self === void 0 ? void 0 : self.permissions) === null || _a === void 0 ? void 0 : _a.off('*', this.chatPermissionUpdateListener);
        (_b = participants === null || participants === void 0 ? void 0 : participants.joined) === null || _b === void 0 ? void 0 : _b.off('participantJoined', this.participantJoinedListener);
        (_c = participants === null || participants === void 0 ? void 0 : participants.joined) === null || _c === void 0 ? void 0 : _c.off('participantLeft', this.participantLeftListener);
    }
    overridesChanged(overrides) {
        var _a, _b;
        if (!this.meeting || this.meeting.self)
            return;
        this.showPrivateChat =
            !!(((_a = this.meeting.self.permissions.chatPrivate) === null || _a === void 0 ? void 0 : _a.canSend) ||
                ((_b = this.meeting.self.permissions.chatPrivate) === null || _b === void 0 ? void 0 : _b.canReceive)) && !overrides.disablePrivateChat;
    }
    meetingChanged(meeting, oldMeeting) {
        var _a, _b, _c, _d, _e, _f, _g;
        if (oldMeeting)
            this.disconnectMeeting(oldMeeting);
        if (!meeting || !meeting.chat)
            return;
        this.showPrivateChat =
            !!(((_a = meeting.self.permissions.chatPrivate) === null || _a === void 0 ? void 0 : _a.canSend) ||
                ((_b = meeting.self.permissions.chatPrivate) === null || _b === void 0 ? void 0 : _b.canReceive)) && !this.overrides.disablePrivateChat;
        this.onParticipantUpdate();
        (_c = meeting.chat) === null || _c === void 0 ? void 0 : _c.on('chatUpdate', this.chatUpdateListener);
        meeting.self.permissions.on('*', this.chatPermissionUpdateListener);
        (_e = (_d = meeting === null || meeting === void 0 ? void 0 : meeting.participants) === null || _d === void 0 ? void 0 : _d.joined) === null || _e === void 0 ? void 0 : _e.on('participantJoined', this.participantJoinedListener);
        (_g = (_f = meeting === null || meeting === void 0 ? void 0 : meeting.participants) === null || _f === void 0 ? void 0 : _f.joined) === null || _g === void 0 ? void 0 : _g.on('participantLeft', this.participantLeftListener);
    }
    render() {
        if (!this.showPrivateChat)
            return null;
        return (h(Host, null, h("div", { class: "chat-header", onClick: this.toggle }, h("div", { class: "chat-header-label" }, this.selectedUser ? (h("rtk-icon", { icon: this.iconPack.people, size: "sm" })) : (h("rtk-icon", { icon: this.iconPack.participants, size: "sm" })), !this.selectedUser ? this.t('chat.everyone') : this.selectedUser.name), h("div", { class: "chevron" }, h("rtk-icon", { icon: this.isOpen ? this.iconPack.chevron_up : this.iconPack.chevron_down, size: "sm" }))), h("div", { class: { dropdown: true, open: this.isOpen, scrollbar: true } }, h("div", { class: "public-chat-group-label", onClick: () => this.selectUser(undefined) }, h("div", { class: "public-chat-icon" }, h("rtk-icon", { icon: this.iconPack.participants, size: "sm" })), this.t('chat.everyone')), h("rtk-paginated-list", { class: "chat-selector-paginated-list", ref: (el) => (this.$paginatedListRef = el), pageSize: this.pageSize, pagesAllowed: 3, fetchData: this.getParticipants, createNodes: this.createPaticipantNodes, emptyListLabel: this.t('participants.empty_list') }, h("slot", null)))));
    }
    static get watchers() { return {
        "overrides": [{
                "overridesChanged": 0
            }],
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "meeting", void 0);
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "states", void 0);
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "config", void 0);
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "iconPack", void 0);
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "t", void 0);
__decorate$e([
    SyncWithStore()
], RtkChatSelector.prototype, "overrides", void 0);
RtkChatSelector.style = rtkChatSelectorCss();

const rtkDraftAttachmentViewCss = () => `:host{display:flex;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));border-top-left-radius:var(--rtk-border-radius-md, 8px);border-top-right-radius:var(--rtk-border-radius-md, 8px)}.preview-overlay{position:absolute;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);background-color:inherit}.preview{position:absolute;top:var(--rtk-space-4, 16px);left:var(--rtk-space-4, 16px);max-width:-moz-fit-content;max-width:fit-content;max-height:var(--rtk-space-20, 80px)}.preview:hover rtk-tooltip{display:block}.preview rtk-tooltip{position:absolute;top:calc(var(--rtk-space-1, 4px) * -1);left:calc(var(--rtk-space-1, 4px) * -1);display:none;margin-left:calc(var(--rtk-space-1, 4px) * -1);margin-top:calc(var(--rtk-space-1, 4px) * -1)}.preview rtk-button{display:flex;height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px);align-items:center;justify-content:center;border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity));border:1px solid rgb(var(--rtk-colors-text-1000, 255 255 255))}.preview rtk-icon{height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px);color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.preview-image{height:var(--rtk-space-16, 64px);width:var(--rtk-space-16, 64px);-o-object-fit:cover;object-fit:cover;max-height:100%;max-width:100%;overflow:clip;border-radius:var(--rtk-border-radius-md, 8px)}.preview-file{padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);padding-top:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-2, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));overflow:hidden;text-overflow:ellipsis;white-space:nowrap;border-radius:var(--rtk-border-radius-md, 8px);max-width:200px}`;

var __decorate$d = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkDraftAttachmentView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onDeleteAttachment = createEvent(this, "deleteAttachment", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Attachment to display */
        this.attachment = null;
        this.filePreview = null;
        this.fileReader = new FileReader();
        this.generatePreview = () => {
            if (this.attachment.type === 'image') {
                this.fileReader.readAsDataURL(this.attachment.file);
            }
            else if (this.attachment.type === 'file') {
                this.filePreview = this.attachment.file.name;
            }
        };
        this.onDeleteClickHandler = () => {
            this.filePreview = null;
            this.onDeleteAttachment.emit();
        };
    }
    onAttachmentChange() {
        this.generatePreview();
    }
    connectedCallback() {
        this.fileReader.onload = (e) => {
            if (typeof e.target.result === 'string') {
                this.filePreview = e.target.result;
            }
        };
        // this.fileReader.onloadstart = () => {};
        // this.fileReader.onloadend = () => {};
    }
    componentWillLoad() {
        this.onAttachmentChange();
    }
    render() {
        return (h(Host, { key: '4bdc44453552e63a40d31d851a752009d4df74d1' }, h("div", { key: 'c3024512c383063e7b7be4c3006c726ce9641670', class: "preview-overlay" }, h("div", { key: 'a14d0cd7148029828baea3fc9261c7b8f70f5bfc', class: "preview" }, h("rtk-tooltip", { key: '600f07d41fcf00b156120268fdbdff165ae9c040', label: this.t('chat.cancel_upload') }, h("rtk-button", { key: '99059cb78c5451758fe859bb002a05ab3827f718', variant: "secondary", kind: "icon", onClick: this.onDeleteClickHandler }, h("rtk-icon", { key: '422f06eb7d08f0708e9c46dc64eb329708a9307a', icon: this.iconPack.dismiss }))), this.attachment.type === 'image' ? (h("img", { class: "preview-image", src: this.filePreview })) : (h("div", { class: "preview-file" }, h("span", null, this.filePreview)))))));
    }
    static get watchers() { return {
        "attachment": [{
                "onAttachmentChange": 0
            }]
    }; }
};
__decorate$d([
    SyncWithStore()
], RtkDraftAttachmentView.prototype, "iconPack", void 0);
__decorate$d([
    SyncWithStore()
], RtkDraftAttachmentView.prototype, "t", void 0);
RtkDraftAttachmentView.style = rtkDraftAttachmentViewCss();

const EMOJI_ASSET_URL = 'https://rtk-assets.realtime.cloudflare.com/assets/emojis-data.json';
let cachedEmojis;
/**
 * fetches the latest emoji list from CDN
 * @returns list of emojis
 */
const fetchEmojis = async () => {
    if (!cachedEmojis) {
        const emojis = await fetch(EMOJI_ASSET_URL);
        cachedEmojis = emojis.json();
    }
    return cachedEmojis;
};

const rtkEmojiPickerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{width:100%}.emoji-parent{box-sizing:border-box;display:inline-flex;height:var(--rtk-space-64, 256px);width:100%;max-width:640px;flex-direction:column;padding:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-0, 0px);-webkit-user-select:none;-moz-user-select:none;user-select:none;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.close-parent{display:flex;flex:1 1 0%;justify-content:flex-end;padding:var(--rtk-space-0, 0px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}#emoji-grid{margin-top:var(--rtk-space-2, 8px);box-sizing:border-box;display:flex;flex-direction:row;flex-wrap:wrap;align-content:flex-start;overflow-x:hidden;overflow-y:scroll;height:100%;grid-auto-rows:minmax(min-content, max-content)}#loader{display:flex;height:100%;width:100%;align-items:center;justify-content:center}input{display:block;height:var(--rtk-space-8, 32px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);font-size:14px;border-width:var(--rtk-border-width-none, 0);border-style:solid;border-style:none;border-color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88))}input::-moz-placeholder{color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}input::placeholder{color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}input{border-radius:var(--rtk-border-radius-sm, 4px);outline:2px solid transparent;outline-offset:2px;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}input:focus{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-border-opacity));--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(4px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);--tw-ring-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-ring-opacity));--tw-ring-opacity:0.3}.emoji{height:var(--rtk-space-10, 40px);width:var(--rtk-space-10, 40px);font-size:20px;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}`;

var __decorate$c = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkEmojiPicker = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.pickerClose = createEvent(this, "pickerClose", 7);
        this.emojiClicked = createEvent(this, "rtkEmojiClicked", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Controls whether or not to focus on mount */
        this.focusWhenOpened = true;
        this.filterVal = '';
        this.filteredEmojis = [];
    }
    componentWillLoad() {
        // Don't use async here as it will block the render
        fetchEmojis().then((e) => {
            this.emojiList = e;
            this.handleInputChange(this.inputElement);
        });
    }
    componentDidLoad() {
        if (this.focusWhenOpened) {
            this.inputElement.focus();
        }
    }
    handleInputChange(target) {
        this.filterVal = target.value;
        const regex = new RegExp(`([^,]*?${this.filterVal}[^,]*):(\\d+)`, 'g');
        this.filteredEmojis = Array.from(this.emojiList['search'].matchAll(regex)).map((m) => {
            return { name: m[1], emoji: this.emojiList['emojis'][m[2]] };
        });
    }
    handleEmojiClick(emoji) {
        this.emojiClicked.emit(emoji);
    }
    mapEmojiList() {
        var _a;
        if (((_a = this.emojiList) === null || _a === void 0 ? void 0 : _a.length) > 0) {
            return (h("div", { id: "loader" }, h("rtk-spinner", { iconPack: this.iconPack })));
        }
        return (h("div", { id: "emoji-grid", class: "scrollbar max-w-40" }, this.filteredEmojis.map((e) => (h("rtk-button", { key: `emoji-button-${e.name}`, class: "emoji", variant: "ghost", kind: "icon", title: e.name, onClick: () => this.handleEmojiClick(e.emoji) }, e.emoji)))));
    }
    render() {
        return (h(Host, { key: 'e2b74cd93028974812eeba320368eb7d645b8e6d' }, h("div", { key: '4656f9afbcde1e6a952a5eb7229649e3d9f7bf8a', class: 'close-parent' }, h("rtk-button", { key: '03759c6ee2b3b8bedcf965d340425bf9b7a9f370', variant: "ghost", kind: "icon", class: "close", onClick: () => { var _a; return (_a = this.pickerClose) === null || _a === void 0 ? void 0 : _a.emit(); }, "aria-label": this.t('close') }, h("rtk-icon", { key: 'b5b746e6c18e2a67a57f550f35bb32ea4de37cb9', icon: this.iconPack.dismiss }))), h("div", { key: '73235fd8e554ece4539e4d2fc9b086c32e43bd47', class: 'emoji-parent' }, h("input", { key: '315f45bcc6560f61d7c8448fee7d2e36ca04784d', value: this.filterVal, onInput: (event) => this.handleInputChange(event.target), placeholder: this.t('search'), ref: (el) => (this.inputElement = el) }), this.mapEmojiList())));
    }
};
__decorate$c([
    SyncWithStore()
], RtkEmojiPicker.prototype, "iconPack", void 0);
__decorate$c([
    SyncWithStore()
], RtkEmojiPicker.prototype, "t", void 0);
RtkEmojiPicker.style = rtkEmojiPickerCss();

const rtkEmojiPickerButtonCss = () => `:host{}`;

var __decorate$b = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkEmojiPickerButton = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
    }
    render() {
        return (h("rtk-tooltip", { key: 'aef7b8c5bfdd8888a7fcca9ba9ba2df7ca801da4', label: this.t('chat.send_emoji') }, h("rtk-button", { key: 'e7b23bcd81515fe0cae3916b4de7565547472171', variant: "ghost", kind: "icon", class: { active: this.isActive }, title: this.t('chat.send_emoji') }, h("rtk-icon", { key: 'af7e05bb06b9fe01b47e8f11f09a957e37187f63', icon: this.iconPack.emoji_multiple }))));
    }
};
__decorate$b([
    SyncWithStore()
], RtkEmojiPickerButton.prototype, "iconPack", void 0);
__decorate$b([
    SyncWithStore()
], RtkEmojiPickerButton.prototype, "t", void 0);
RtkEmojiPickerButton.style = rtkEmojiPickerButtonCss();

const rtkFileMessageViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.file{display:flex;align-items:center;gap:var(--rtk-space-1, 4px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px);min-width:var(--rtk-space-40, 160px);max-width:var(--rtk-space-64, 256px);border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.file .file-data{margin-left:var(--rtk-space-1, 4px);flex:1 1 0%}.file .file-data .name{word-break:break-all;color:rgb(var(--rtk-colors-text-1000, 255 255 255));overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}.file .file-data .file-data-split{margin-top:var(--rtk-space-0\\.5, 2px);display:flex;align-items:center;font-size:12px}.file .file-data .file-data-split .ext{margin-right:var(--rtk-space-2, 8px);text-transform:uppercase;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}.file .file-data .file-data-split .divider{height:var(--rtk-space-4, 16px);width:var(--rtk-space-0\\.5, 2px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.file .file-data .file-data-split .size{margin-left:var(--rtk-space-2, 8px)}`;

var __decorate$a = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkFileMessageView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
    }
    render() {
        return (h("div", { key: '10de68cdb7ebb9bc5579f1d26ac20b00909f5236', class: "file" }, h("rtk-button", { key: 'ba255f55de300a1d9cbc4ccf3fb5ec3f93670d50', variant: "secondary", kind: "icon", onClick: () => downloadFile(sanitizeLink(this.url), { name: this.name, fallbackName: 'file' }), part: "button" }, h("rtk-icon", { key: '2ff668ad0b4b48f0cb05acc9f62727bf4cb9bbd5', icon: this.iconPack.download })), h("div", { key: '4b77a03fc4896994430c1bf814767622e5c21cf4', class: "file-data" }, h("div", { key: 'df4dfdf5d2cffb47cc635c8bc410e5bd3f478570', class: "name" }, this.name), h("div", { key: '6bafabd74cc4d6fe0585874542f183519c6e1000', class: "file-data-split" }, h("div", { key: '5ba6f3fcc10a2d8e580e584597c946c650e6d58c', class: "ext" }, getExtension(this.name)), h("span", { key: '682887e1f3ebaf33c48704f7443bb1de3c3c5201', class: "divider" }), h("div", { key: 'fc2c82f17558a794a2192c9e4a23d9888a176b6e', class: "size" }, getFileSize(this.size))))));
    }
};
__decorate$a([
    SyncWithStore()
], RtkFileMessageView.prototype, "iconPack", void 0);
RtkFileMessageView.style = rtkFileMessageViewCss();

const rtkFilePickerButtonCss = () => `:host{}`;

var __decorate$9 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkFilePickerButton = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onFileChange = createEvent(this, "fileChange", 7);
        /** Icon */
        this.icon = 'attach';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.uploadFile = () => {
            const input = this.fileInputField;
            input.type = 'file';
            if (this.filter) {
                input.accept = this.filter;
            }
            input.onchange = (e) => {
                const { validity, files: [file], } = e.target;
                if (validity.valid) {
                    this.onFileChange.emit(file);
                }
            };
            input.click();
        };
    }
    connectedCallback() {
        this.fileInputField = document.createElement('input');
    }
    disconnectedCallback() {
        // For GC
        this.fileInputField = undefined;
    }
    render() {
        const label = this.label || this.t('chat.send_file');
        const icon = this.iconPack[this.icon];
        return (h("rtk-tooltip", { key: '329c452b2de6664978946000c6264e823c87830d', label: label }, h("rtk-button", { key: '7b6a275ab946ad2aa751c8e36a6c9701f5fa0dab', variant: "ghost", kind: "icon", onClick: () => this.uploadFile(), title: label }, h("rtk-icon", { key: 'd3306859b107d0988c24f098db21467787b03afc', icon: icon }))));
    }
};
__decorate$9([
    SyncWithStore()
], RtkFilePickerButton.prototype, "iconPack", void 0);
__decorate$9([
    SyncWithStore()
], RtkFilePickerButton.prototype, "t", void 0);
RtkFilePickerButton.style = rtkFilePickerButtonCss();

const rtkIconCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block;height:var(--rtk-space-10, 40px);outline:2px solid transparent;outline-offset:2px}:host .icon-wrapper{display:flex;height:100%;width:100%;flex-direction:column;align-items:center}:host svg{height:100%;width:100%;outline:2px solid transparent;outline-offset:2px}:host([size='xl']){box-sizing:border-box;display:block;height:var(--rtk-space-16, 64px) !important;width:var(--rtk-space-16, 64px) !important;--rtk-spinner-color:currentColor}:host([size='md']){box-sizing:border-box;display:block;height:var(--rtk-space-6, 24px) !important;width:var(--rtk-space-6, 24px) !important;--rtk-spinner-color:currentColor}:host([size='sm']){box-sizing:border-box;display:block;height:var(--rtk-space-4, 16px) !important;width:var(--rtk-space-4, 16px) !important;--rtk-spinner-color:currentColor}:host([variant='secondary']) .icon-wrapper{--tw-text-opacity:1;color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-text-opacity))}:host([variant='danger']) .icon-wrapper{--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}`;

const parseIcon = (icon) => {
    try {
        return JSON.parse(icon);
    }
    catch (e) {
        return icon;
    }
};
const RtkIcon = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon variant */
        this.variant = 'primary';
        /** Size */
        this.size = 'lg';
    }
    render() {
        return (h(Host, { key: 'fdbe6fd9647bae7cfdf02ba6a250aa3c0c39ad85' }, h("div", { key: '114baca2f9ce9376e69073b40170473cc359915f', class: "icon-wrapper", innerHTML: parseIcon(this.icon), part: "wrapper" })));
    }
};
RtkIcon.style = rtkIconCss();

const rtkImageMessageViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.image-spinner{cursor:wait}.image-errored{cursor:not-allowed}.image{display:block;font-family:var(--rtk-font-family, sans-serif);color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));position:relative;height:var(--rtk-space-40, 160px);max-width:var(--rtk-space-64, 256px);cursor:pointer}.image img{display:none;height:100%;width:100%;border-radius:var(--rtk-border-radius-sm, 4px);-o-object-fit:cover;object-fit:cover}.image .image-spinner{display:flex;height:100%;width:100%;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.image .image-spinner rtk-spinner{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-text-opacity))}.image .image-errored{display:flex;height:100%;width:100%;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--rtk-border-radius-sm, 4px);background-color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.1);--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}.image .actions{display:none;height:var(--rtk-space-8, 32px);align-items:center;position:absolute;top:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));overflow:hidden;--tw-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)}.image .actions .action{height:var(--rtk-space-8, 32px);width:var(--rtk-space-8, 32px);border-radius:var(--rtk-border-radius-none, 0);border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:transparent;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)}.image .actions .action:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.image.loaded img{display:block}.image.loaded .image-spinner{display:none}.image:hover .actions,.image:focus .actions{display:flex}`;

var __decorate$8 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkImageMessageView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onPreview = createEvent(this, "preview", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.status = 'loading';
    }
    render() {
        return (h("div", { key: '4f52d3d7ff948d02832cf5f53ae9b483c8502b84', class: { image: true, loaded: this.status === 'loaded' } }, h("img", { key: '06efe7798b2d59ee6b3acde68418763c89fc285f', src: sanitizeLink(this.url), onLoad: () => {
                this.status = 'loaded';
            }, onError: () => {
                this.status = 'errored';
            }, onClick: () => {
                if (this.status === 'loaded') {
                    this.onPreview.emit(this.url);
                }
            } }), this.status === 'loading' && (h("div", { key: '366f02c0b48cf06e527cc0b3c42ef1ac5ff0ac36', class: "image-spinner", title: this.t('chat.img.loading'), "aria-label": this.t('chat.img.loading') }, h("rtk-spinner", { key: '90cd7d607487b8016ab838a31bcee39aacec0ba2', iconPack: this.iconPack }))), this.status === 'errored' && (h("div", { key: 'd7b1fe803153799855aa8220af81f6b973b9117d', class: "image-errored", title: this.t('chat.error.img_not_found'), "aria-label": this.t('chat.error.img_not_found') }, h("rtk-icon", { key: '83060f609b0df333aa91d3b21a4634d943d2352f', icon: this.iconPack.image_off }))), this.status === 'loaded' && (h("div", { key: '1db7dc269511f477c60faa681fb39cfa09a517ab', class: "actions" }, h("rtk-button", { key: 'a45138b3cfeeae245d28d3493396e5c5ea102b49', class: "action", variant: "secondary", kind: "icon", onClick: () => {
                this.onPreview.emit(this.url);
            } }, h("rtk-icon", { key: 'b44a303fa4ed28a2a39ef372dfa5b58908698a2c', icon: this.iconPack.full_screen_maximize })), h("rtk-button", { key: '0e687d5c92264a8d2fa28e1921ccbd4797bfd2e3', class: "action", variant: "secondary", kind: "icon", onClick: () => downloadFile(this.url, { fallbackName: 'image' }) }, h("rtk-icon", { key: '1f2d01d576a2faa7483ada2e82f5cbf4cb8534b5', icon: this.iconPack.download }))))));
    }
};
__decorate$8([
    SyncWithStore()
], RtkImageMessageView.prototype, "iconPack", void 0);
__decorate$8([
    SyncWithStore()
], RtkImageMessageView.prototype, "t", void 0);
RtkImageMessageView.style = rtkImageMessageViewCss();

const rtkMarkdownViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{overflow-wrap:break-word}a{color:currentColor}.block-quote,blockquote{margin:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-3, 12px);--tw-border-spacing-x:1px;--tw-border-spacing-y:1px;border-spacing:var(--tw-border-spacing-x) var(--tw-border-spacing-y);border-top-width:var(--rtk-border-width-none, 0);border-bottom-width:var(--rtk-border-width-none, 0);border-left-width:var(--rtk-border-width-md, 2px);border-right-width:var(--rtk-border-width-none, 0);border-style:solid;padding:var(--rtk-space-0\\.5, 2px);padding-left:var(--rtk-space-2, 8px);border-radius:var(--rtk-border-radius-sm, 4px);border-top-left-radius:var(--rtk-border-radius-none, 0);border-bottom-left-radius:var(--rtk-border-radius-none, 0)}pre{white-space:pre-wrap;width:300px;margin-right:var(--rtk-space-2, 8px)}.markdown-message{box-sizing:border-box}`;

const RtkMarkdownView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** max length of text to render as markdown */
        this.maxLength = MAX_TEXT_LENGTH;
        this.restoreEmpty = (content, tag, renderCallback) => {
            return content.trim().length === 0 ? `${tag}${content}${tag}` : renderCallback(content);
        };
        this.renderLink = (content) => {
            return (h("a", { class: "link", href: content, target: "_blank", rel: "noopener noreferrer" }, content));
        };
        this.renderBold = (content) => {
            if (typeof content === 'string') {
                return this.restoreEmpty(content, '*', (c) => h("b", null, c));
            }
            return h("b", null, this.renderTokens(content));
        };
        this.renderItalic = (content) => {
            if (typeof content === 'string') {
                return this.restoreEmpty(content, '_', (c) => h("i", null, c));
            }
            return h("i", null, this.renderTokens(content));
        };
        this.renderStrikethrough = (content) => {
            if (typeof content === 'string') {
                return this.restoreEmpty(content, '~', (c) => h("s", null, c));
            }
            return h("b", null, this.renderTokens(content));
        };
        this.renderPlainText = (content) => {
            if (typeof content === 'string') {
                return content;
            }
            return h("p", null, this.renderTokens(content));
        };
        this.renderTokens = (tokens) => {
            return tokens.map((token) => {
                switch (token.type) {
                    case 'a':
                        if (typeof token.content === 'string') {
                            return this.renderLink(token.content);
                        }
                    case 'b':
                        return this.renderBold(token.content);
                    case 'i':
                        return this.renderItalic(token.content);
                    case 's':
                        return this.renderStrikethrough(token.content);
                    case 'q':
                        return h("span", { class: "block-quote" });
                    case 'plain_text':
                    default:
                        return this.renderPlainText(token.content);
                }
            });
        };
    }
    renderMessage(text) {
        let lines = text.split('\n');
        let isCodeBlock = false;
        if (lines[0] === '```' && lines[lines.length - 1] === '```') {
            isCodeBlock = true;
            lines = lines.slice(1, -1);
        }
        const message = lines.map((line) => {
            const tokens = parseRichText(line);
            return h("p", null, this.renderTokens(tokens));
        });
        if (isCodeBlock) {
            return h("pre", { style: { whiteSpace: 'pre', overflow: 'scroll' } }, lines.join('\n'));
        }
        return message;
    }
    render() {
        const slicedMessage = this.text.slice(0, this.maxLength);
        const withReply = extractReplyBlock(slicedMessage, true);
        const withoutReply = stripOutReplyBlock(slicedMessage);
        return (h("p", { key: 'ff1a72f01b0cf274f0135874dade41d08771b6af', class: "markdown-message" }, withReply.length !== 0 && h("blockquote", { key: '35f779d8e7aa8f4ea44f16b2d35094cb9740a3f5' }, this.renderMessage(withReply)), withoutReply.length !== 0 && this.renderMessage(withoutReply)));
    }
};
RtkMarkdownView.style = rtkMarkdownViewCss();

const md = 768;
const lg = 1080;
var breakpoints = {
	md: md,
	lg: lg};

/**
 * Get the screen breakpoint from a given width
 * @param width The width of the container
 * @returns The screen breakpoint value
 */
const getSize = (width) => {
    if (width >= breakpoints.lg)
        return 'lg';
    else if (width >= breakpoints.md)
        return 'md';
    else
        return 'sm';
};

const rtkMeetingCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{box-sizing:border-box;display:flex;flex-direction:column;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));overflow:hidden;position:fixed;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);bottom:var(--rtk-space-0, 0px);left:var(--rtk-space-0, 0px);height:100%;width:100%}:host([mode='fill']){position:relative}`;

const RtkMeeting = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.statesUpdate = createEvent(this, "rtkStatesUpdate", 7);
        /** Since RtkMeeting by design works as a provider for component, to be in sync with other providers, added provider id */
        this.providerId = 'provider-' + Math.floor(Math.random() * 100);
        this.roomJoinedListener = () => {
            this.updateStates({ meeting: 'joined', preJoinError: null });
        };
        this.waitlistedListener = () => {
            this.updateStates({ meeting: 'waiting' });
        };
        this.roomLeftListener = ({ state }) => {
            // Let socketConnectionUpdate listener handle this case.
            if (state === 'disconnected' || state === 'failed')
                return;
            this.updateStates({ meeting: 'ended', roomLeftState: state });
        };
        this.mediaPermissionUpdateListener = ({ kind, message }) => {
            if (['audio', 'video'].includes(kind)) {
                if ((message === 'DENIED' || message === 'SYSTEM_DENIED') &&
                    (this.peerStore || uiStore).state.states.activeDebugger !== true) {
                    const permissionModalSettings = {
                        enabled: true,
                        kind,
                    };
                    this.updateStates({ activePermissionsMessage: permissionModalSettings });
                }
            }
        };
        this.socketConnectionUpdateListener = ({ state }) => {
            if (state === 'failed') {
                setTimeout(() => {
                    this.meeting.leave('disconnected');
                }, this.leaveRoomTimer);
            }
        };
        this.peerStore = null; // peer specific store for this meeting peer instance
        /** Whether to load config from preset */
        this.loadConfigFromPreset = false;
        /** Whether to apply the design system on the document root from config */
        this.applyDesignSystem = false;
        /** Fill type */
        this.mode = 'fixed';
        /** Whether participant should leave when this component gets unmounted */
        this.leaveOnUnmount = false;
        /** Language */
        this.t = useLanguage();
        /** UI Config */
        this.config = createDefaultConfig();
        /** Grid layout */
        this.gridLayout = 'row';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** UI Kit Overrides */
        this.overrides = defaultOverrides;
        this.handleChangingMeeting = (destinationMeetingId) => {
            const currentStates = (this.peerStore || uiStore).state.states;
            this.updateStates({
                activeBreakoutRoomsManager: Object.assign(Object.assign({}, currentStates.activeBreakoutRoomsManager), { destinationMeetingId }),
            });
        };
    }
    connectedCallback() {
        var _a;
        if (typeof window !== 'undefined') {
            this.initErrorListener = (ev) => {
                const errorInfo = getInitErrorInfo(this.t, ev.detail);
                if (errorInfo) {
                    this.updateStates({ preJoinError: errorInfo });
                }
            };
            window.addEventListener('ClientError', this.initErrorListener);
        }
        // Initialize default values
        this.leaveRoomTimer = 10000;
        this.loadConfigFromPreset = true;
        this.applyDesignSystem = true;
        // Setup event listeners
        this.setupStoreRequestListener();
        this.setupStateUpdateListener();
        this.meetingChanged(this.meeting);
        this.iconPackChanged(this.iconPack);
        this.tChanged(this.t);
        this.configChanged(this.config);
        this.overridesChanged(this.overrides);
        this.resizeObserver = new index(() => this.handleResize());
        this.resizeObserver.observe(this.host);
        if (this.applyDesignSystem &&
            ((_a = this.config) === null || _a === void 0 ? void 0 : _a.designTokens) != null &&
            typeof document !== 'undefined' &&
            (this.peerStore || uiStore).state.states.activeDebugger !== true) {
            provideRtkDesignSystem(document.documentElement, this.config.designTokens);
        }
    }
    disconnectedCallback() {
        var _a;
        if (this.leaveOnUnmount) {
            (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.leave();
        }
        this.resizeObserver.disconnect();
        window.removeEventListener('ClientError', this.initErrorListener);
        // Remove event listeners
        if (this.storeRequestListener) {
            this.host.removeEventListener('rtkRequestStore', this.storeRequestListener);
            this.storeRequestListener = null;
        }
        if (this.stateUpdateListener) {
            this.host.removeEventListener('rtkStateUpdate', this.stateUpdateListener);
            this.stateUpdateListener = null;
        }
        // Clear meeting listeners
        if (this.meeting) {
            this.clearListeners(this.meeting);
        }
    }
    setupStoreRequestListener() {
        // Remove existing listener if any
        if (this.storeRequestListener) {
            this.host.removeEventListener('rtkRequestStore', this.storeRequestListener);
        }
        // Listen for store requests from child components
        this.storeRequestListener = (event) => {
            // Provide peer specific store if available, otherwise fall back to global store
            if (!this.peerStore)
                return;
            const storeToProvide = this.peerStore;
            const responseEvent = new CustomEvent('rtkProvideStore', {
                detail: { store: storeToProvide, requestId: event.detail.requestId },
            });
            document.dispatchEvent(responseEvent);
            // Stop the event from bubbling further to prevent other meetings from handling it
            event.stopPropagation();
        };
        this.host.addEventListener('rtkRequestStore', this.storeRequestListener);
    }
    setupStateUpdateListener() {
        if (this.stateUpdateListener) {
            this.host.removeEventListener('rtkStateUpdate', this.stateUpdateListener);
        }
        this.stateUpdateListener = (event) => {
            const eventTarget = event.target;
            if (!this.host.contains(eventTarget)) {
                return;
            }
            this.updateStates(event.detail);
        };
        this.host.addEventListener('rtkStateUpdate', this.stateUpdateListener);
    }
    clearListeners(meeting) {
        if (!meeting)
            return;
        meeting.self.removeListener('roomLeft', this.roomLeftListener);
        meeting.self.removeListener('roomJoined', this.roomJoinedListener);
        meeting.self.removeListener('waitlisted', this.waitlistedListener);
        meeting.self.removeListener('mediaPermissionUpdate', this.mediaPermissionUpdateListener);
        meeting.meta.removeListener('socketConnectionUpdate', this.socketConnectionUpdateListener);
    }
    meetingChanged(meeting, oldMeeting) {
        var _a, _b;
        if (!meeting)
            return;
        // Create peer specific store for this meeting peer instance
        if (meeting) {
            this.peerStore = createPeerStore({
                meeting,
                config: this.config,
                iconPack: this.iconPack,
                t: this.t,
                providerId: this.providerId,
                overrides: merge(Object.assign({}, defaultOverrides), this.overrides),
            });
            // Notify components that peer specific store is now available
            document.dispatchEvent(new CustomEvent('rtkPeerStoreReady', {
                detail: {
                    peerId: meeting.self.id,
                },
            }));
        }
        else {
            this.peerStore = null;
        }
        const targetStore = this.peerStore || uiStore;
        /** Honor user's explicit choice for captions, but respect preset default if no explicit choice */
        const desiredActiveCaptionsState = !oldMeeting
            ? !!meeting.self.permissions.transcriptionEnabled
            : !!targetStore.state.states.activeCaptions;
        this.updateStates({
            viewType: meeting.meta.viewType,
            activeCaptions: desiredActiveCaptionsState,
        });
        if (this.loadConfigFromPreset && meeting.self.config != null) {
            const theme = meeting.self.config;
            const { config, data } = generateConfig(theme, meeting);
            this.config = config;
            if (this.showSetupScreen == null) {
                this.showSetupScreen = data.showSetupScreen;
            }
            if ((_a = targetStore.state.states.activeBreakoutRoomsManager) === null || _a === void 0 ? void 0 : _a.destinationMeetingId) {
                this.showSetupScreen = false;
            }
        }
        if (this.applyDesignSystem &&
            ((_b = this.config) === null || _b === void 0 ? void 0 : _b.designTokens) != null &&
            typeof document !== 'undefined' &&
            targetStore.state.states.activeDebugger !== true) {
            provideRtkDesignSystem(document.documentElement, this.config.designTokens);
        }
        meeting.self.addListener('roomJoined', this.roomJoinedListener);
        meeting.self.addListener('waitlisted', this.waitlistedListener);
        meeting.self.addListener('roomLeft', this.roomLeftListener);
        meeting.self.addListener('mediaPermissionUpdate', this.mediaPermissionUpdateListener);
        meeting.meta.addListener('socketConnectionUpdate', this.socketConnectionUpdateListener);
        meeting.connectedMeetings.once('changingMeeting', this.handleChangingMeeting);
        if (meeting.self.roomJoined) {
            this.updateStates({ meeting: 'joined' });
        }
        else {
            if (this.showSetupScreen) {
                this.updateStates({ meeting: 'setup' });
            }
            else {
                meeting
                    .join()
                    .then(() => {
                    this.updateStates({ preJoinError: null });
                })
                    .catch((err) => {
                    const { message, code } = getJoinErrorInfo(this.t, err);
                    this.updateStates({ preJoinError: { message, code } });
                });
            }
        }
        window.removeEventListener('ClientError', this.initErrorListener);
    }
    iconPackChanged(newIconPack) {
        if (this.peerStore) {
            this.peerStore.state.iconPack = newIconPack;
        }
    }
    tChanged(newT) {
        if (this.peerStore) {
            this.peerStore.state.t = newT;
        }
    }
    configChanged(config) {
        if (this.peerStore) {
            this.peerStore.state.config = config;
        }
        if ((config === null || config === void 0 ? void 0 : config.designTokens) &&
            typeof document !== 'undefined' &&
            (this.peerStore || uiStore).state.states.activeDebugger !== true) {
            provideRtkDesignSystem(document.documentElement, config.designTokens);
        }
    }
    overridesChanged(overrides) {
        if (this.peerStore) {
            this.peerStore.state.overrides = merge(Object.assign({}, defaultOverrides), overrides);
        }
    }
    handleResize() {
        this.size = getSize(this.host.clientWidth);
    }
    updateStates(states) {
        // Use peer specific store if available, otherwise fall back to global store
        const targetStore = this.peerStore || uiStore;
        const newStates = Object.assign({}, targetStore.state.states);
        targetStore.state.states = merge(newStates, states);
        // Emit unscoped event for backward compatibility
        this.statesUpdate.emit(targetStore.state.states);
        // Also emit a scoped event that only this meeting's components should listen to
        const scopedEvent = new CustomEvent('rtkStatesUpdate', {
            detail: targetStore.state.states,
            bubbles: true,
            composed: true,
        });
        this.host.dispatchEvent(scopedEvent);
    }
    render() {
        const defaults = {
            meeting: this.meeting,
            size: this.size,
            states: (this.peerStore || uiStore).state.states,
            config: this.config || createDefaultConfig(),
            iconPack: this.iconPack,
            t: this.t,
        };
        if ((this.peerStore || uiStore).state.states.viewType === 'CHAT') {
            return h("rtk-chat", Object.assign({}, defaults));
        }
        const elementProps = {
            'rtk-grid': {
                layout: this.gridLayout,
            },
        };
        return h(Render, { element: "rtk-meeting", defaults: defaults, asHost: true, elementProps: elementProps });
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "iconPack": [{
                "iconPackChanged": 0
            }],
        "t": [{
                "tChanged": 0
            }],
        "config": [{
                "configChanged": 0
            }],
        "overrides": [{
                "overridesChanged": 0
            }]
    }; }
};
RtkMeeting.style = rtkMeetingCss();

const rtkMenuCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:inline-block;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}#menu-list{position:absolute;z-index:20;display:none}`;

var __decorate$7 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkMenu$1 = class RtkMenu {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.clickedThis = false;
        /** Placement of menu */
        this.placement = 'bottom-end';
        /** Offset in px */
        this.offset = 10;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.handleOutsideClick = () => {
            // handles clicking on other menu triggers
            if (!this.clickedThis) {
                // if other trigger is clicked, hide this menu-list
                this.menuListEl.style.display = 'none';
            }
            // reset the value
            this.clickedThis = false;
        };
    }
    componentDidLoad() {
        document.addEventListener('click', this.handleOutsideClick);
        this.update();
    }
    disconnectedCallback() {
        document.removeEventListener('click', this.handleOutsideClick);
    }
    update() {
        computePosition(this.triggerEl, this.menuListEl, {
            placement: this.placement,
            middleware: [offset(this.offset), flip(), shift({ padding: 5 })],
        }).then(({ x, y }) => {
            Object.assign(this.menuListEl.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
        });
    }
    render() {
        return (h(Host, { key: 'c7cf93be6e90e8e8e09b1ff8ff717b328ab91660' }, h("span", { key: '6b77e648ffbf038450bfdc36c45a50d7a73e6bb4', id: "trigger", ref: (el) => (this.triggerEl = el), onClick: () => {
                this.clickedThis = true;
                if (this.menuListEl.style.display !== 'block') {
                    this.menuListEl.style.display = 'block';
                    this.update();
                }
                else {
                    this.menuListEl.style.display = 'none';
                }
            } }, h("slot", { key: '08c30f54a39dfc8c21a248e63c9879fcb93b4ad0', name: "trigger" })), h("span", { key: '7d824c0d9140fa47cf4a72463b5d795c86f026a4', part: "menu-list", id: "menu-list", ref: (el) => (this.menuListEl = el) }, h("slot", { key: 'fc13149fe4447fada518248c30258d0e908d3030' }))));
    }
};
__decorate$7([
    SyncWithStore()
], RtkMenu$1.prototype, "iconPack", void 0);
__decorate$7([
    SyncWithStore()
], RtkMenu$1.prototype, "t", void 0);
RtkMenu$1.style = rtkMenuCss();

const rtkMenuItemCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;align-items:center;padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);padding-top:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-2, 8px);cursor:pointer;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms;color:rgb(var(--rtk-colors-text-1000, 255 255 255));font-size:14px}::slotted([slot='start']){margin-right:var(--rtk-space-2, 8px)}::slotted([slot='end']){margin-left:var(--rtk-space-2, 8px)}:host(:hover){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}:host(.primary:hover){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-400, 53 110 253) / var(--tw-bg-opacity))}:host(.red){--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}`;

var __decorate$6 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkMenuItem = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Variant */
        this.menuVariant = 'secondary';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
    }
    render() {
        return (h(Host, { key: '34effd6df180c6a3d5a356f481934c9312f62f83', class: { [this.menuVariant]: true } }, h("slot", { key: 'c2313c150db2f804e9170bd8c93afdbc68d05bc8', name: "start" }), h("slot", { key: '5c8428b279af80a626fa300e4cafae55cc987170' }), h("slot", { key: 'a5eab032080c4ca615fd1cd848c30675232e3043', name: "end" })));
    }
};
__decorate$6([
    SyncWithStore()
], RtkMenuItem.prototype, "iconPack", void 0);
__decorate$6([
    SyncWithStore()
], RtkMenuItem.prototype, "t", void 0);
RtkMenuItem.style = rtkMenuItemCss();

const rtkMenuListCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;width:-moz-max-content;width:max-content;flex-direction:column;padding:var(--rtk-space-0, 0px);color:rgb(var(--rtk-colors-text-1000, 255 255 255));border-width:1px;border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));overflow:hidden;border-radius:var(--rtk-border-radius-sm, 4px);--tw-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);backdrop-filter:blur(60px)}:host(.primary){--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-bg-opacity))}`;

var __decorate$5 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkMenuList = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Variant */
        this.menuVariant = 'secondary';
        /** Language */
        this.t = useLanguage();
    }
    render() {
        return (h(Host, { key: '083bcaabc43d7a19060a0922b1106514f5267d6e', class: { [this.menuVariant]: true } }, h("slot", { key: 'd1ecbf870d71e99fc2b2345359e61d61c51dc039' })));
    }
};
__decorate$5([
    SyncWithStore()
], RtkMenuList.prototype, "iconPack", void 0);
__decorate$5([
    SyncWithStore()
], RtkMenuList.prototype, "t", void 0);
RtkMenuList.style = rtkMenuListCss();

const rtkMessageViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{max-width:var(--rtk-space-96, 384px)}.message-wrapper{display:flex;flex-direction:row-reverse;align-items:flex-start;gap:var(--rtk-space-2, 8px)}.message-wrapper.incoming{flex-direction:row}.message{display:flex;flex-direction:column;align-items:flex-end}.incoming .message{display:flex;flex-direction:column;align-items:flex-start}.header{margin-top:var(--rtk-space-1, 4px);margin-bottom:var(--rtk-space-1, 4px);align-self:flex-end;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));font-size:12px;font-weight:600}.incoming .header{align-self:flex-start}.body{display:flex;flex-direction:column;min-width:var(--rtk-space-24, 96px);font-family:var(--rtk-font-family, sans-serif);color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));font-size:14px;line-height:1.375;position:relative}.bubble{max-width:90%;padding:var(--rtk-space-2, 8px);border-width:1px;border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)));border-radius:var(--rtk-border-radius-md, 8px);line-height:1}.incoming .bubble{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88))}.metadata{margin-top:var(--rtk-space-1, 4px);display:flex;flex-direction:row;align-items:center;gap:var(--rtk-space-1, 4px);align-self:flex-end;font-size:11px;color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)))}.incoming .metadata{margin-top:var(--rtk-space-1, 4px);display:flex;flex-direction:row;align-items:center;gap:var(--rtk-space-1, 4px);align-self:flex-end;font-size:11px;color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.metadata-content{display:flex;flex-direction:row;align-items:center;gap:var(--rtk-space-1, 4px)}.avatar{display:none}rtk-menu{position:absolute;right:var(--rtk-space-1, 4px);top:var(--rtk-space-1, 4px);border-radius:var(--rtk-border-radius-lg, 12px)}rtk-menu rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px);cursor:pointer}.actions{display:flex;align-items:center;justify-content:center;border-width:1px;border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-bg-opacity));padding:var(--rtk-space-1, 4px);border-radius:var(--rtk-border-radius-md, 8px);border-width:var(--rtk-border-width-none, 0);border-style:none}.actions rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px);color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)))}.incoming rtk-avatar{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88))}.incoming .actions{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}@media (min-width: 400px){.avatar{display:flex;width:var(--rtk-space-6, 24px)}.avatar rtk-avatar{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px);font-size:10px;overflow:clip;border-radius:9999px}}@media (hover: hover){rtk-menu{visibility:hidden}.body:hover rtk-menu{visibility:visible}}`;

var __decorate$4 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkMessageView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onAction = createEvent(this, "action", 7);
        /** List of actions to show in menu */
        this.actions = [];
        /** Appearance */
        this.variant = 'bubble';
        /** Is message pinned */
        this.pinned = false;
        /** Render */
        this.viewType = 'outgoing';
        /** Hides avatar */
        this.hideAvatar = false;
        /** Is the message sent by the current user */
        this.isSelf = false;
        /** Hides author display label */
        this.hideAuthorName = false;
        /** Hides metadata (time) */
        this.hideMetadata = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
    }
    renderActions() {
        return (h("rtk-menu", { placement: this.isSelf ? 'bottom-start' : 'bottom-end', offset: 1 }, h("button", { slot: "trigger", class: "actions" }, h("rtk-icon", { icon: this.iconPack.chevron_down })), h("rtk-menu-list", { menuVariant: this.isSelf ? 'primary' : 'secondary' }, this.actions.map((action) => {
            if (action.id === 'edit_message' && this.messageType !== 'text')
                return;
            return (h("rtk-menu-item", { menuVariant: this.isSelf ? 'primary' : 'secondary', onClick: () => this.onAction.emit(action.id) }, action.icon && h("rtk-icon", { icon: action.icon, slot: "start" }), action.label));
        }))));
    }
    render() {
        return (h(Host, { key: '3d53fc59bda6a82e4c4753e34f915c8f62611f6b' }, h("div", { key: '1f9cbd79c9e5526645fafd0c4436b91c6c612f08', class: { 'message-wrapper': true, [this.viewType]: true } }, !this.hideAvatar && (h("aside", { key: '23071b4dff9dd4ecc1385be9a1610ffbab98a9e9', class: "avatar", part: "avatar" }, h("rtk-avatar", { key: '9a4596ea3636188ef391e65f86d6a608b3aa02d5', participant: { name: this.authorName, picture: this.avatarUrl }, size: "sm" }))), h("div", { key: 'eefe1bf5803e371266a0b8ee230dd2f42a193dc2', class: "message", part: "message" }, !this.hideAuthorName && (h("div", { key: '45ba437f7a3ba2b253f22a1885d7e5be954a387e', class: "header" }, this.authorName, " ", this.isSelf ? ' (You)' : '')), h("div", { key: 'e9636fb45358423d5cc4e8144b6b47cf065117cc', class: { body: true, bubble: this.variant === 'bubble' } }, h("slot", { key: '1d6cd92eb8d4514b7ae4266fae8cd060a56ac1e3' }), !this.hideMetadata && !!this.time && (h("div", { key: '77b29974a960e4b4809025305ce005aeab8edebc', class: "metadata", title: formatDateTime(this.time) }, this.pinned && (h("span", { key: 'e6b99085f2cbcbc9505c20e5407a98c382306614', class: "metadata-content" }, h("rtk-icon", { key: '45ad875ef38b1db0105c85659cf938cc9bd792d8', icon: this.iconPack.pin, size: "sm" }), " \u2022")), this.isEdited && (h("span", { key: '48d5ecd659fe2308d8c33e94a2216049a2bea5ef', class: "metadata-content" }, h("span", { key: '9203ff6d3f65b81b875f5bc17231fd2c65c1c2c2' }, "Edited"), " \u2022")), elapsedDuration(this.time, new Date(Date.now())))), this.actions.length !== 0 && this.renderActions())))));
    }
};
__decorate$4([
    SyncWithStore()
], RtkMessageView.prototype, "iconPack", void 0);
RtkMessageView.style = rtkMessageViewCss();

const rtkPaginatedListCss = () => `.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{position:relative;display:flex;flex-direction:column;flex:1}:host(.chat-selector-paginated-list) .container{box-sizing:border-box;display:flex;flex-direction:column;padding:var(--rtk-space-2, 8px);flex:1 0 0px;overflow-y:scroll}:host(.chat-selector-paginated-list) .private-chat-label{display:flex;width:100%;cursor:pointer;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px)}:host(.chat-selector-paginated-list) .private-chat-label rtk-avatar{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}:host(.chat-selector-paginated-list) .show-new-messages-ctr.active{display:none}.private-chat-unread-badge{height:var(--rtk-space-2, 8px);width:var(--rtk-space-2, 8px);border-radius:9999px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity))}:host(.pinned-message-selector-paginated-list) .container{box-sizing:border-box;display:flex;flex-direction:column-reverse;padding:var(--rtk-space-2, 8px);flex:1 0 0px;overflow-y:scroll}:host(.pinned-message-selector-paginated-list) .page{position:relative;box-sizing:border-box}:host(.pinned-message-selector-paginated-list) .pinned-message{box-sizing:border-box;display:flex;width:100%;cursor:pointer;flex-direction:row;overflow:hidden;border-radius:var(--rtk-border-radius-sm, 4px)}:host(.pinned-message-selector-paginated-list) .pinned-message:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}:host(.pinned-message-selector-paginated-list) .pinned-message-container{display:flex;width:100%;flex-direction:row;align-items:flex-start;padding:var(--rtk-space-2, 8px)}:host(.pinned-message-selector-paginated-list) .pinned-message-content{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);display:flex;min-width:var(--rtk-space-0, 0px);flex:1 1 0%;flex-direction:column}:host(.pinned-message-selector-paginated-list) .pinned-message-time{font-size:12px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}:host(.pinned-message-selector-paginated-list) .pinned-message-preview{margin-bottom:var(--rtk-space-2, 8px);word-break:break-all;color:rgb(var(--rtk-colors-text-1000, 255 255 255));overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2}:host(.pinned-message-selector-paginated-list) rtk-avatar{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}.container{box-sizing:border-box;display:flex;flex-direction:column-reverse;padding-top:var(--rtk-space-4, 16px);padding-bottom:var(--rtk-space-4, 16px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);flex:1 0 0px;overflow-y:scroll}.file-picker{display:none}.chat *:first-child{margin-top:var(--rtk-space-0, 0px)}.chat .head{display:flex;align-items:center}.chat .head .name{margin-right:var(--rtk-space-4, 16px);font-size:12px;font-weight:700}.chat .head .time{font-size:12px;color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.chat .body{margin-top:var(--rtk-space-2, 8px);margin-bottom:var(--rtk-space-2, 8px);overflow-wrap:break-word;font-size:14px;line-height:1.375}.chat .body .emoji{font-size:24px}p{margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-3, 12px)}rtk-text-message,rtk-image-message,rtk-file-message{margin-top:var(--rtk-space-4, 16px);display:block;padding-left:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-3, 12px);font-family:var(--rtk-font-family, sans-serif);color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));box-sizing:border-box}*[is-continued]{margin-top:var(--rtk-space-3, 12px)}rtk-text-message[is-continued]{margin-top:var(--rtk-space-2, 8px)}.chat .image{position:relative;height:var(--rtk-space-40, 160px);max-width:var(--rtk-space-64, 256px);cursor:pointer}.chat .image img{display:none;height:100%;width:100%;border-radius:var(--rtk-border-radius-sm, 4px);-o-object-fit:cover;object-fit:cover}.chat .image .image-spinner{display:flex;height:100%;width:100%;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.chat .image .image-spinner rtk-spinner{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-text-opacity))}.chat .image .image-errored{display:flex;height:100%;width:100%;flex-direction:column;align-items:center;justify-content:center;border-radius:var(--rtk-border-radius-sm, 4px);background-color:rgba(var(--rtk-colors-danger, 255 45 45) / 0.1);--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}.chat .image .actions{display:none;height:var(--rtk-space-8, 32px);align-items:center;position:absolute;top:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));overflow:hidden;--tw-shadow:0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);--tw-shadow-colored:0 10px 15px -3px var(--tw-shadow-color), 0 4px 6px -4px var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)}.chat .image .actions .action{height:var(--rtk-space-8, 32px);width:var(--rtk-space-8, 32px);border-radius:var(--rtk-border-radius-none, 0);border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:transparent;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)}.chat .image .actions .action:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.image.loaded img{display:block}.image.loaded .image-spinner{display:none}.image:hover .actions,.image:focus .actions{display:flex}.chat .file{display:flex;align-items:center;gap:var(--rtk-space-1, 4px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);padding-top:var(--rtk-space-1\\.5, 6px);padding-bottom:var(--rtk-space-1\\.5, 6px);border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.chat .file .file-data{flex:1 1 0%}.chat .file .file-data .name{word-break:break-all;color:rgb(var(--rtk-colors-text-1000, 255 255 255));overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}.chat .file .file-data .file-data-split{margin-top:var(--rtk-space-0\\.5, 2px);display:flex;align-items:center;font-size:12px}.chat .file .file-data .file-data-split .ext{margin-right:var(--rtk-space-2, 8px);text-transform:uppercase;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}.chat .file .file-data .file-data-split .divider{height:var(--rtk-space-4, 16px);width:var(--rtk-space-0\\.5, 2px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.chat .file .file-data .file-data-split .size{margin-left:var(--rtk-space-2, 8px)}.smallest-dom-element{width:1px}#top-scroll{transform:translateY(20vh);transform:translateY(20px)}a{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity));text-decoration-line:none}a:hover{text-decoration-line:underline}.show-new-messages-ctr{position:absolute;bottom:var(--rtk-space-4, 16px);right:var(--rtk-space-4, 16px);z-index:10;margin-top:calc(var(--rtk-space-14, 56px) * -1);--tw-translate-y:var(--rtk-space-28, 112px);transform:translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));opacity:0;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms}.show-new-messages-ctr.active{--tw-translate-y:var(--rtk-space-0, 0px);transform:translate(var(--tw-translate-x), var(--tw-translate-y)) rotate(var(--tw-rotate)) skewX(var(--tw-skew-x)) skewY(var(--tw-skew-y)) scaleX(var(--tw-scale-x)) scaleY(var(--tw-scale-y));cursor:pointer;opacity:1}.show-new-messages{pointer-events:auto;border-radius:9999px}.show-new-messages:hover{border-radius:9999px;--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);--tw-ring-opacity:1;--tw-ring-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-ring-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}rtk-spinner,.empty-list{margin:auto}.page-wrapper{margin-left:var(--rtk-space-1, 4px);margin-right:var(--rtk-space-1, 4px);display:flex;flex-direction:column-reverse}.message-wrapper{margin-bottom:var(--rtk-space-2, 8px)}.pinned .message-wrapper{position:relative}.pinned .pin-icon{position:absolute;right:calc(var(--rtk-space-1, 4px) * -1);top:calc(var(--rtk-space-1, 4px) * -1);display:flex;border-radius:var(--rtk-border-radius-sm, 4px)}.pinned rtk-message-view{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px)}.load-more-on-top-container{pointer-events:none;position:absolute;top:var(--rtk-space-2, 8px);right:var(--rtk-space-4, 16px);z-index:10}.load-more-icon{pointer-events:auto;border-radius:9999px}.load-more-icon:hover{--tw-ring-offset-shadow:var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color);--tw-ring-shadow:var(--tw-ring-inset) 0 0 0 calc(2px + var(--tw-ring-offset-width)) var(--tw-ring-color);box-shadow:var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow, 0 0 #0000);--tw-ring-opacity:1;--tw-ring-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-ring-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}`;

/**
 * NOTE(ikabra): INFINITE SCROLL IMPLEMENTATION:
 *
 * Uses scrollend listener for 2way scrolling.
 * Empty divs ($topRef, $bottomRef) act as scroll triggers to fetch new messages.
 *
 * UPWARD SCROLLING:
 * - Fetch top anchor (element currently visible to the user near top)
 * - Fetch older messages, push to end of 2D array
 * - When exceeding pagesAllowed, delete pages and scroll back to anchor
 *
 * DOWNWARD SCROLLING:
 * - Fetch bottom anchor (element currently visible to the user near bottom)
 * - Fetch new page, insert at the start
 * - Update timestamps & firstEmptyIndex, then rerender
 * - When exceeding pagesAllowed, delete pages and scroll back to anchor
 *
 * ADDING NEW NODES:
 * - If no pages exist, load old page
 * - If on 1st page, append messages till page size is full and then load new page
 *
 * DELETE NODE:
 * - If deleting the only available node, reset to initial state
 * - If page is empty, delete it
 * - Update timestamp curors
 */
var __decorate$3 = (undefined && undefined.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
const RtkPaginatedList = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        // Timestamp pertaining to the oldest stored message
        this.oldestPaginatedTimestamp = 0;
        // Timestamp pertaining to the latest stored message
        this.latestPaginatedTimestamp = null;
        // Timestamp pertaining to the latest message stored in backend
        this.latestMessageTimestamp = null;
        // the length of pages will always be pageSize + 2
        this.pages = [];
        // Controls whether to keep auto-scrolling when a new page load.
        this.shouldScrollToBottom = false;
        // Shows "scroll to bottom" button when new nodes arrive and autoscroll is off.
        this.showNewMessagesCTR = false;
        /** label to show when empty */
        this.emptyListLabel = null;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.rerenderBoolean = false;
        this.showEmptyListLabel = false;
        this.isLoading = false;
        this.isLoadingTop = false;
        this.isLoadingBottom = false;
        // Tells us if we need to scroll to a specific anchor after a rerender
        this.pendingScrollAnchor = null;
        this.isInView = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.top >= 0 && rect.bottom <= window.innerHeight;
        };
    }
    /**
     * Rerender paginated list
     */
    async rerenderList() {
        this.rerenderBoolean = !this.rerenderBoolean;
    }
    /**
     * Adds a new node to the beginning of the paginated list
     * @param {DataNode} node - The data node to add to the beginning of the list
     */
    async onNewNode(node) {
        // if there are no pages, append to the first page
        if (this.pages.length < 1) {
            this.oldestPaginatedTimestamp = node.timeMs;
            this.pages.unshift([node]);
            this.latestPaginatedTimestamp = node.timeMs;
            this.latestMessageTimestamp = node.timeMs;
            this.rerender();
            if (this.autoScroll)
                this.$bottomRef.scrollIntoView({ behavior: 'smooth' });
        }
        else if (this.latestMessageTimestamp === this.latestPaginatedTimestamp) {
            // append messages to the page if page has not reached full capacity
            if (this.pages[0].length < this.pageSize) {
                this.pages[0].unshift(node);
                this.latestPaginatedTimestamp = node.timeMs;
                this.latestMessageTimestamp = node.timeMs;
                this.rerender();
            }
            else {
                // if page is at full capacity, load next page
                this.pages.unshift([node]);
                this.latestPaginatedTimestamp = node.timeMs;
                this.latestMessageTimestamp = node.timeMs;
                // remove pages if out of bounds
                if (this.pages.length > this.pagesAllowed)
                    this.pages.pop();
                // update timestamps
                const lastPage = this.pages[this.pages.length - 1];
                this.oldestPaginatedTimestamp = lastPage[lastPage.length - 1].timeMs;
                this.rerender();
            }
            if (this.autoScroll)
                this.$bottomRef.scrollIntoView({ behavior: 'smooth' });
        }
        else {
            if (this.autoScroll)
                this.scrollToBottom();
        }
        this.pendingScrollAnchor = null;
    }
    /**
     * Deletes a node anywhere from the list
     * @param {string} id - The id of the node to delete
     * */
    async onNodeDelete(id) {
        var _a, _b;
        for (let i = this.pages.length - 1; i >= 0; i--) {
            const index = this.pages[i].findIndex((node) => node.id === id);
            // if message not found, move on
            if (index === -1)
                continue;
            // delete message
            this.pages[i].splice(index, 1);
            // if page is empty, delete it
            if (this.pages[i].length === 0)
                this.pages.splice(i, 1);
            // update timestamps
            const firstPage = this.pages[0];
            const lastPage = this.pages[this.pages.length - 1];
            this.latestPaginatedTimestamp = (_a = firstPage === null || firstPage === void 0 ? void 0 : firstPage[0]) === null || _a === void 0 ? void 0 : _a.timeMs;
            this.oldestPaginatedTimestamp = (_b = lastPage === null || lastPage === void 0 ? void 0 : lastPage[lastPage.length - 1]) === null || _b === void 0 ? void 0 : _b.timeMs;
            // if I have deleted the latest message, update latestMessageTimestamp
            if (index === 0 && i === 0)
                this.latestMessageTimestamp = this.latestPaginatedTimestamp;
            this.rerender();
            break;
        }
    }
    /**
     * Updates a new node anywhere in the list
     * @param {string} id - The id of the node to update
     * @param {DataNode} node - The updated data node
     * */
    async onNodeUpdate(id, node) {
        for (let i = this.pages.length - 1; i >= 0; i--) {
            const index = this.pages[i].findIndex((node) => node.id === id);
            // if message not found, move on
            if (index === -1)
                continue;
            // edit message
            this.pages[i][index] = Object.assign(Object.assign({}, this.pages[i][index]), node);
            this.rerender();
            break;
        }
    }
    /**
     * Resets the paginated list to a given timestamp
     */
    async reset(timestamp = 0) {
        this.oldestPaginatedTimestamp = timestamp;
        this.latestPaginatedTimestamp = null;
        this.pages = [];
        this.shouldScrollToBottom = false;
        this.showNewMessagesCTR = false;
        this.pendingScrollAnchor = null;
        this.isLoading = false;
        this.isLoadingTop = false;
        this.isLoadingBottom = false;
        if (timestamp === 0) {
            // preserve latestMessageTimestamp if reseting to a particular message
            this.latestMessageTimestamp = null;
        }
        this.rerender();
        await this.loadPrevPage();
    }
    connectedCallback() {
        this.rerender = debounce(this.rerender.bind(this), 50, { maxWait: 200 });
    }
    componentDidLoad() {
        // initial load
        this.loadPrevPage();
        if (this.$containerRef) {
            this.$containerRef.onscrollend = async () => {
                // do not do anything if we are scrolling to bottom
                if (this.shouldScrollToBottom)
                    return;
                // handle top and bottom scroll
                if (this.isInView(this.$bottomRef) &&
                    this.latestMessageTimestamp > this.latestPaginatedTimestamp) {
                    await this.loadNextPage();
                }
                else if (this.isInView(this.$topRef)) {
                    this.showNewMessagesCTR = true;
                    await this.loadPrevPage();
                }
            };
        }
    }
    componentDidRender() {
        if (!this.pendingScrollAnchor)
            return;
        const anchor = this.pendingScrollAnchor;
        this.pendingScrollAnchor = null;
        this.restoreScrollToAnchor(anchor);
    }
    async loadPrevPage() {
        if (this.isLoading)
            return;
        const scrollAnchor = this.getScrollAnchor('top');
        // if old timestamp is 0, it means we are at initial state
        if (this.oldestPaginatedTimestamp === 0)
            this.oldestPaginatedTimestamp = new Date().getTime();
        // load data
        this.isLoading = true;
        this.isLoadingTop = true;
        const data = await this.fetchData(this.oldestPaginatedTimestamp - 1, this.pageSize, true);
        this.isLoading = false;
        this.isLoadingTop = false;
        // no more old messages to show, we are at the top of the page
        if (!data.length)
            return;
        // add old data to the end of the array
        this.pages.push(data);
        // clear old pages when we reach the limit
        if (this.pages.length > this.pagesAllowed)
            this.pages.shift();
        // update timestamps
        const lastPage = this.pages[this.pages.length - 1];
        this.oldestPaginatedTimestamp = lastPage[lastPage.length - 1].timeMs;
        this.latestPaginatedTimestamp = this.pages[0][0].timeMs;
        if (!this.latestMessageTimestamp)
            this.latestMessageTimestamp = this.latestPaginatedTimestamp;
        this.rerender();
        // fix scroll position
        if (scrollAnchor)
            this.pendingScrollAnchor = scrollAnchor;
    }
    async loadNextPage() {
        if (this.isLoading)
            return [];
        // Do nothing. New timestamp needs to be assigned by loadPrevPage method
        if (!this.latestPaginatedTimestamp) {
            this.showNewMessagesCTR = false;
            return [];
        }
        this.isLoading = true;
        this.isLoadingBottom = true;
        const scrollAnchor = this.getScrollAnchor('bottom');
        const data = await this.fetchData(this.latestPaginatedTimestamp + 1, this.pageSize, false);
        this.isLoading = false;
        this.isLoadingBottom = false;
        // no more new messages to load
        if (!data.length) {
            this.latestMessageTimestamp = this.latestPaginatedTimestamp;
            this.showNewMessagesCTR = false;
            return [];
        }
        // load new messages and append to the start
        const incoming = [...data].reverse();
        if (this.pages.length === 0)
            this.pages.unshift([]);
        const firstPage = this.pages[0];
        const spaceInFirstPage = this.pageSize - firstPage.length;
        if (spaceInFirstPage > 0) {
            const toFill = incoming.splice(0, spaceInFirstPage);
            firstPage.unshift(...toFill);
        }
        while (incoming.length > 0) {
            this.pages.unshift(incoming.splice(0, this.pageSize));
        }
        // remove pages if out of bounds
        if (this.pages.length > this.pagesAllowed)
            this.pages.pop();
        // update timestamps
        const lastPage = this.pages[this.pages.length - 1];
        this.oldestPaginatedTimestamp = lastPage[lastPage.length - 1].timeMs;
        this.latestPaginatedTimestamp = this.pages[0][0].timeMs;
        this.rerender();
        this.pendingScrollAnchor = scrollAnchor;
        return data;
    }
    // Find the element that is closest to the top/bottom of the container
    getScrollAnchor(edge = 'top') {
        if (!this.$containerRef)
            return null;
        const containerRect = this.$containerRef.getBoundingClientRect();
        const candidates = Array.from(this.$containerRef.querySelectorAll('[id]')).filter((el) => el.id !== 'top-scroll' && el.id !== 'bottom-scroll');
        let best = null;
        for (const el of candidates) {
            const rect = el.getBoundingClientRect();
            const isVisibleInContainer = rect.bottom > containerRect.top && rect.top < containerRect.bottom;
            if (!isVisibleInContainer)
                continue;
            if (edge === 'top') {
                const offsetTop = rect.top - containerRect.top;
                if (best == null || (best.edge === 'top' && offsetTop < best.offsetTop)) {
                    best = { id: el.id, edge: 'top', offsetTop };
                }
            }
            else {
                const offsetBottom = containerRect.bottom - rect.bottom;
                if (best == null || (best.edge === 'bottom' && offsetBottom < best.offsetBottom)) {
                    best = { id: el.id, edge: 'bottom', offsetBottom };
                }
            }
        }
        return best;
    }
    //instant scroll to anchor to make sure we are at the same position after a rerender
    restoreScrollToAnchor(anchor) {
        if (!this.$containerRef)
            return;
        // make element id safe to use inside a CSS selector
        const escapeId = (id) => {
            var _a;
            const cssEscape = (_a = globalThis.CSS) === null || _a === void 0 ? void 0 : _a.escape;
            return typeof cssEscape === 'function'
                ? cssEscape(id)
                : id.replace(/[^a-zA-Z0-9_-]/g, '\\$&');
        };
        const el = this.$containerRef.querySelector(`#${escapeId(anchor.id)}`);
        if (!el)
            return;
        const containerRect = this.$containerRef.getBoundingClientRect();
        const rect = el.getBoundingClientRect();
        if (anchor.edge === 'top') {
            const newOffsetTop = rect.top - containerRect.top;
            this.$containerRef.scrollTop += newOffsetTop - anchor.offsetTop;
        }
        else {
            const newOffsetBottom = containerRect.bottom - rect.bottom;
            this.$containerRef.scrollTop += anchor.offsetBottom - newOffsetBottom;
        }
    }
    // this method is called recursively based on shouldScrollToBottom (see loadNextPage)
    async scrollToBottom() {
        this.shouldScrollToBottom = true;
        while (this.shouldScrollToBottom) {
            const response = await this.loadNextPage();
            this.$bottomRef.scrollIntoView({ behavior: 'smooth' });
            if (response.length === 0)
                this.shouldScrollToBottom = false;
        }
    }
    rerender() {
        this.rerenderBoolean = !this.rerenderBoolean;
    }
    render() {
        var _a;
        /**
         * div.container is flex=column-reversewhich is why div#bottom-scroll comes before div#top-scroll
         */
        return (h(Host, { key: 'bff4fc91b737334c5764e690fbf2adafa1444408' }, h("div", { key: 'f4efa98ef0bd178602ee03718d35fcb833487909', class: "scrollbar container", part: "container", ref: (el) => (this.$containerRef = el) }, h("div", { key: '37403f6462812a6662efa9577ae9ed43d27f63d6', class: { 'show-new-messages-ctr': true, active: this.showNewMessagesCTR } }, h("rtk-button", { key: 'ee7e04e6281370dddb1b1e10b753e96dc602d42a', class: "show-new-messages", kind: "icon", variant: "secondary", part: "show-new-messages", onClick: () => {
                this.scrollToBottom();
            } }, this.shouldScrollToBottom ? (h("rtk-spinner", { size: "sm" })) : (h("rtk-icon", { icon: this.iconPack.chevron_down })))), h("div", { key: '91bcdadd2518313fa06306a172575f5acc786596', class: "smallest-dom-element", id: "bottom-scroll", ref: (el) => (this.$bottomRef = el) }), this.isLoadingBottom && this.pages.length > 0 && h("rtk-spinner", { key: '932af19af69c3ecd5af22dd3051a5eea5cb25e7a', size: "sm" }), this.isLoading && this.pages.length < 1 && h("rtk-spinner", { key: '9fa60fb784a09800a32a3accdc81d940476330d2', size: "lg" }), !this.isLoading && this.pages.flat().length === 0 ? (h("div", { class: "empty-list" }, (_a = this.emptyListLabel) !== null && _a !== void 0 ? _a : this.t('list.empty'))) : (h("div", { class: "page-wrapper" }, this.pages.map((page, pageIndex) => (h("div", { class: "page", "data-page-index": pageIndex }, this.createNodes([...page].reverse())))))), this.isLoadingTop && this.pages.length > 0 && h("rtk-spinner", { key: '73103f58338bdb89be69f9f6dc742e3cdd2c95d8', size: "sm" }), h("div", { key: '9c4c43ffb6442d58040448fe1b2d7332505fc81e', class: "smallest-dom-element", id: "top-scroll", ref: (el) => (this.$topRef = el) }))));
    }
};
__decorate$3([
    SyncWithStore()
], RtkPaginatedList.prototype, "iconPack", void 0);
__decorate$3([
    SyncWithStore()
], RtkPaginatedList.prototype, "t", void 0);
RtkPaginatedList.style = rtkPaginatedListCss();

const rtkPinnedMessageSelectorCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{display:flex;width:100%;flex-direction:column;font-size:14px;position:relative;box-sizing:border-box;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-header{position:relative;margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);cursor:pointer;gap:var(--rtk-space-2, 8px);padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);display:flex;flex-direction:row;align-items:center;justify-content:space-between;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));border-radius:var(--rtk-border-radius-sm, 4px);border:var(--rtk-border-width-sm, 1px) solid rgb(var(--rtk-colors-background-600, 60 60 60))}.chat-header-label{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px)}.dropdown{position:absolute;top:100%;z-index:10;padding:var(--rtk-space-0, 0px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));opacity:0;pointer-events:none;border-bottom-right-radius:var(--rtk-border-radius-sm, 4px);border-bottom-left-radius:var(--rtk-border-radius-sm, 4px);left:var(--rtk-space-2, 8px);right:var(--rtk-space-2, 8px);max-width:calc(100vw - var(--rtk-space-4, 16px));box-sizing:border-box}.dropdown.open{opacity:1;pointer-events:auto;border-width:1px;border-top-width:var(--rtk-border-width-none, 0);border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity))}.dropdown rtk-paginated-list{box-sizing:border-box;display:flex;height:30vh;flex-direction:column}`;

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
const RtkPinnedMessageSelector = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.dropdownToggle = createEvent(this, "rtkDropdownToggle", 7);
        this.pinnedMessageSelect = createEvent(this, "rtkPinnedMessageSelect", 7);
        this.isOpen = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        //NOTE(ikabra): Fix this value once backend supports pagination for participants
        this.pageSize = 25;
        this.pagesAllowed = 3;
        this.showPinnedMessages = true;
        this.toggle = (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.isOpen = !this.isOpen;
            this.dropdownToggle.emit({ open: this.isOpen });
        };
        this.getPinnedChatMessages = async (timestamp, size, reversed) => {
            const localMeeting = this.meeting;
            if (!localMeeting)
                return [];
            try {
                const messages = await localMeeting.chat.fetchPinnedMessages({
                    timestamp,
                    limit: size,
                    direction: reversed ? 'before' : 'after',
                });
                return messages;
            }
            catch (err) {
                return [];
            }
        };
        this.createPinnedChatNodes = (messages) => {
            return messages.map((message) => {
                const preview = message.type === 'text'
                    ? (message.message || '').replace(/\s+/g, ' ').trim()
                    : message.type === 'file'
                        ? 'File Attachment'
                        : message.type === 'image'
                            ? 'Image Attachment'
                            : '';
                return (h("div", { class: "pinned-message", id: message.id, onClick: () => {
                        this.pinnedMessageSelect.emit(message);
                        this.close();
                    } }, h("div", { class: "pinned-message-container" }, h("rtk-avatar", { size: "sm", participant: {
                        name: message.displayName,
                        picture: '',
                    } }), h("div", { class: "pinned-message-content" }, h("div", { class: "pinned-message-preview", title: preview }, preview), h("div", { class: "pinned-message-meta" }, h("span", { class: "pinned-message-time" }, elapsedDuration(message.time, new Date(Date.now()))))))));
            });
        };
        this.pinChatListener = (data) => {
            var _a, _b;
            if (((_a = data.message.targetUserIds) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                // pinned messages are not supported for private chat
                return;
            }
            /**
             * FIXME(ikabra): This is a temporary hack to refresh the list when a new message is pinned.
             * This is done to avoid duplicate messages in the list.
             * Fix is being implemented by socket where they are updating the `updatedAt` timestamp when the message is pinned.
             */
            (_b = this.$paginatedListRef) === null || _b === void 0 ? void 0 : _b.reset();
        };
        this.unpinChatListener = async (data) => {
            var _a, _b;
            if (((_a = data.message.targetUserIds) === null || _a === void 0 ? void 0 : _a.length) > 0) {
                // pinned messages are not supported for private chat
                return;
            }
            (_b = this.$paginatedListRef) === null || _b === void 0 ? void 0 : _b.onNodeDelete(data.message.id);
        };
        this.chatUpdateListener = async (data) => {
            if (data.action !== 'delete')
                return;
            this.unpinChatListener(data);
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        this.disconnectMeeting(this.meeting);
    }
    disconnectMeeting(meeting) {
        var _a, _b, _c;
        (_a = meeting.chat) === null || _a === void 0 ? void 0 : _a.removeListener('pinMessage', this.pinChatListener);
        (_b = meeting.chat) === null || _b === void 0 ? void 0 : _b.removeListener('unpinMessage', this.unpinChatListener);
        (_c = meeting.chat) === null || _c === void 0 ? void 0 : _c.removeListener('chatUpdate', this.chatUpdateListener);
    }
    meetingChanged(meeting, oldMeeting) {
        var _a, _b, _c, _d;
        if (oldMeeting)
            this.disconnectMeeting(oldMeeting);
        if (!meeting)
            return;
        (_a = this.$paginatedListRef) === null || _a === void 0 ? void 0 : _a.reset();
        (_b = meeting.chat) === null || _b === void 0 ? void 0 : _b.addListener('pinMessage', this.pinChatListener);
        (_c = meeting.chat) === null || _c === void 0 ? void 0 : _c.addListener('unpinMessage', this.unpinChatListener);
        (_d = meeting.chat) === null || _d === void 0 ? void 0 : _d.addListener('chatUpdate', this.chatUpdateListener);
    }
    /** */
    async close() {
        if (!this.isOpen)
            return;
        this.isOpen = false;
        this.dropdownToggle.emit({ open: false });
    }
    async onChatSelectorChange(event) {
        var _a;
        const selectedUser = (_a = event.detail) === null || _a === void 0 ? void 0 : _a.selectedUser;
        // Everyone
        if (!selectedUser) {
            this.showPinnedMessages = true;
        }
        else {
            this.showPinnedMessages = false;
        }
    }
    render() {
        if (!this.showPinnedMessages)
            return null;
        return (h(Host, null, h("div", { class: "chat-header", onClick: this.toggle }, h("div", { class: "chat-header-label" }, h("rtk-icon", { icon: this.iconPack.pin, size: "sm" }), this.t('chat.pinned_msgs')), h("div", { class: "chevron" }, h("rtk-icon", { icon: this.isOpen ? this.iconPack.chevron_up : this.iconPack.chevron_down, size: "sm" }))), h("div", { class: { dropdown: true, open: this.isOpen, scrollbar: true } }, h("rtk-paginated-list", { class: "pinned-message-selector-paginated-list", ref: (el) => (this.$paginatedListRef = el), pageSize: this.pageSize, pagesAllowed: 3, fetchData: this.getPinnedChatMessages, createNodes: this.createPinnedChatNodes, emptyListLabel: this.t('chat.empty_search') }, h("slot", null)))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$2([
    SyncWithStore()
], RtkPinnedMessageSelector.prototype, "meeting", void 0);
__decorate$2([
    SyncWithStore()
], RtkPinnedMessageSelector.prototype, "iconPack", void 0);
__decorate$2([
    SyncWithStore()
], RtkPinnedMessageSelector.prototype, "t", void 0);
RtkPinnedMessageSelector.style = rtkPinnedMessageSelectorCss();

const rtkSpinnerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{box-sizing:border-box;display:block;height:var(--rtk-space-10, 40px);width:var(--rtk-space-10, 40px);--rtk-spinner-color:currentColor}.spinner{height:100%;width:100%}@keyframes spin{to{transform:rotate(360deg)}}.spinner{animation:spin 1s linear infinite;border-radius:9999px;background-color:transparent;animation-duration:1.3s}:host([size='md']){height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}:host([size='sm']){height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px)}`;

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
const RtkSpinner = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Size */
        this.size = 'md';
    }
    render() {
        return (h(Host, { key: '5e435f3b94bf3a2b9d242d78407390996a76be15' }, h("rtk-icon", { key: '9e9e4200e0dc295bfe9048e57beb6cd809bf53a2', class: "spinner", icon: this.iconPack.spinner })));
    }
};
__decorate$1([
    SyncWithStore()
], RtkSpinner.prototype, "iconPack", void 0);
RtkSpinner.style = rtkSpinnerCss();

const rtkTextComposerViewCss = () => `.chat-input{position:relative;z-index:10;box-sizing:border-box;display:flex;flex-direction:column;border-top-left-radius:var(--rtk-border-radius-md, 8px);border-top-right-radius:var(--rtk-border-radius-md, 8px)}.chat-input textarea{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));box-sizing:border-box;padding:var(--rtk-space-3, 12px);color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-input textarea::-moz-placeholder{color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-input textarea::placeholder{color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.chat-input textarea{font-family:var(--rtk-font-family, sans-serif);outline:2px solid transparent;outline-offset:2px;resize:none;overflow-y:auto;border-width:var(--rtk-border-width-none, 0);border-style:none;min-height:60px;font-size:14px}@container chatcontainer (height < 360px){textarea{height:30px !important;min-height:30px !important}}.text-error{left:var(--rtk-space-0, 0px);z-index:10;margin-top:var(--rtk-space-1, 4px);margin-left:var(--rtk-space-1, 4px);display:flex;width:-moz-fit-content;width:fit-content;align-items:center;justify-content:flex-start;border-radius:var(--rtk-border-radius-sm, 4px);--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-warning, 255 205 7) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity));padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);font-size:12px;font-weight:600;--tw-text-opacity:1;color:rgba(var(--rtk-colors-warning, 255 205 7) / var(--tw-text-opacity));border:1px solid}#warning-indicator{margin-right:var(--rtk-space-1, 4px);height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px)}.text-error.breached{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-border-opacity));--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}`;

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
const RtkTextComposerView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onTextChange = createEvent(this, "textChange", 7);
        /** Disable the text input (default = false) */
        this.disabled = false;
        /** Boolean to indicate if rate limit is breached */
        this.rateLimitBreached = false;
        /** Keydown event handler function */
        this.keyDownHandler = () => { };
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.maxLengthBreached = 0;
        this.onInputHandler = () => {
            const text = this.$textArea.value.trim();
            this.maybeResize(text);
            this.checkLength(text);
            this.onTextChange.emit(text);
        };
        this.maybeResize = (text) => {
            const newLines = [...text.matchAll(/\n/g)].length;
            this.$textArea.style.height = `${Math.min(200, 60 + 20 * newLines)}px`;
        };
    }
    componentDidLoad() {
        if (this.maxLength) {
            this.$textArea.maxLength = this.maxLength;
        }
        const text = this.$textArea.value.trim();
        if (text !== '') {
            this.maybeResize(text);
        }
        this.$textArea.focus();
    }
    /** Sets value of the text input */
    async setText(text, focus = false) {
        this.$textArea.value = text;
        this.maybeResize(text);
        if (focus) {
            this.$textArea.focus();
        }
        this.checkLength(text);
        this.onTextChange.emit(text);
    }
    checkLength(text) {
        // unicode code length
        const textLen = text.length;
        if (textLen + 10 >= this.maxLength) {
            this.maxLengthBreached = text.length;
        }
        else if (textLen + 10 < this.maxLength && this.maxLengthBreached > 0) {
            this.maxLengthBreached = 0;
        }
    }
    render() {
        return (h("div", { key: '900c8fc082af9cffe94011fb0d682802cc450851', class: "chat-input", part: "chat-input-container" }, this.maxLengthBreached > 0 && (h("div", { key: 'fa2362fa593952c3680ae3408c8041c2567342dc', class: 'text-error ' + (this.maxLengthBreached === this.maxLength ? 'breached' : '') }, h("rtk-icon", { key: '0bfa55917acfbe23250bb2b3d487cf27c1eddc58', id: "warning-indicator", icon: this.iconPack.warning, part: "warning-indicator" }), ' ', this.maxLengthBreached, " / ", this.maxLength, " ", this.t('chat.max_limit_warning'))), this.rateLimitBreached && (h("div", { key: 'b4dc7987ec892e6dd8746d21efddeb0a3b765a4c', class: 'text-error breached' }, h("rtk-icon", { key: 'e74b331f6674c5a5a7596d848c7b4846d28a4700', id: "warning-indicator", icon: this.iconPack.warning, part: "warning-indicator" }), ' ', this.t('chat.rate_limit_error'))), h("textarea", { key: '16dfc924b0d935a2e6b4d9fd22418331a9cd1044', ref: (el) => (this.$textArea = el), placeholder: this.placeholder, disabled: this.disabled, onInput: this.onInputHandler, onKeyDown: this.keyDownHandler, part: "chat-input", value: this.value })));
    }
};
__decorate([
    SyncWithStore()
], RtkTextComposerView.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkTextComposerView.prototype, "t", void 0);
RtkTextComposerView.style = rtkTextComposerViewCss();

const rtkTextMessageViewCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.text{word-break:break-word;display:block;overflow-wrap:break-word;line-height:1.375}.text.emoji{font-size:24px}`;

const RtkTextMessageView = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Renders text as markdown (default = true) */
        this.isMarkdown = false;
    }
    render() {
        return (h("p", { key: '45d7cc7d147e74609251f6ab3c2918d42ec6aaea', class: { text: true, emoji: hasOnlyEmojis(this.text) } }, this.isMarkdown ? h("rtk-markdown-view", { text: this.text }) : this.text));
    }
};
RtkTextMessageView.style = rtkTextMessageViewCss();

const rtkTooltipCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{--background-color:var(--rtk-tooltip-background-color, rgb(var(--rtk-colors-background-600, 60 60 60)));--color:var(--rtk-tooltip-color, rgb(var(--rtk-colors-text-1000, 255 255 255)));display:inline-flex}#trigger{display:block;width:100%;flex:1 1 0%}.tooltip{max-width:var(--rtk-space-64, 256px);position:fixed;z-index:20;display:none;width:-moz-max-content;width:max-content;padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);padding-top:var(--rtk-space-1, 4px);padding-bottom:var(--rtk-space-1, 4px);border-radius:var(--rtk-border-radius-sm, 4px);--tw-shadow:0 1px 2px 0 rgb(0 0 0 / 0.05);--tw-shadow-colored:0 1px 2px 0 var(--tw-shadow-color);box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);font-size:12px}.tooltip,#arrow{position:absolute;background-color:var(--background-color);color:var(--color)}#arrow{position:absolute;height:var(--rtk-space-2, 8px);width:var(--rtk-space-2, 8px);transform:rotate(45deg)}:host([variant='primary']){--background-color:rgb(var(--rtk-colors-brand-500, 33 96 253));--color:rgb(var(--rtk-colors-text-on-brand-1000, var(--rtk-colors-text-1000, 255 255 255)))}:host([kind='block']){display:block}`;

const RtkMenu = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.openChange = createEvent(this, "rtkOpenChange", 7);
        /** Tooltip label */
        this.label = '';
        /** Tooltip variant */
        this.variant = 'secondary';
        /** Disabled */
        this.disabled = false;
        /** Open */
        this.open = false;
        /** Tooltip kind */
        this.kind = 'inline';
        /** Placement of menu */
        this.placement = 'top';
        /** Delay before showing the tooltip */
        this.delay = 0;
        this.isInFocus = false;
        this.showMenu = () => {
            if (this.disabled)
                return;
            this.isInFocus = true;
            setTimeout(() => {
                if (this.isInFocus) {
                    this.tooltipEl.style.display = 'block';
                    this.update();
                    this.openChange.emit(true);
                    if (this.size === 'sm') {
                        setTimeout(() => {
                            if (this.isInFocus) {
                                this.hideMenu();
                            }
                        }, 1000);
                    }
                }
            }, this.delay);
        };
        this.hideMenu = () => {
            if (this.open || this.disabled)
                return;
            this.isInFocus = false;
            this.tooltipEl.style.display = 'none';
            this.openChange.emit(false);
        };
    }
    componentDidLoad() {
        this.triggerEl.addEventListener('focusin', this.showMenu);
        this.triggerEl.addEventListener('mouseenter', this.showMenu);
        this.triggerEl.addEventListener('focusout', this.hideMenu);
        this.triggerEl.addEventListener('mouseleave', this.hideMenu);
        writeTask(() => {
            this.openChanged(this.open);
        });
    }
    disconnectedCallback() {
        if (!this.triggerEl)
            return;
        this.triggerEl.removeEventListener('focusin', this.showMenu);
        this.triggerEl.removeEventListener('mouseenter', this.showMenu);
        this.triggerEl.removeEventListener('focusout', this.hideMenu);
        this.triggerEl.removeEventListener('mouseleave', this.hideMenu);
        this.triggerEl = undefined;
    }
    openChanged(open) {
        if (open) {
            this.showMenu();
        }
        else {
            this.hideMenu();
        }
    }
    update() {
        computePosition(this.triggerEl, this.tooltipEl, {
            placement: this.placement,
            middleware: [offset(8), flip(), shift({ padding: 5 }), arrow({ element: this.arrowEl })],
        }).then(({ x, y, placement, middlewareData }) => {
            Object.assign(this.tooltipEl.style, {
                left: `${x}px`,
                top: `${y}px`,
            });
            const { x: arrowX, y: arrowY } = middlewareData.arrow;
            const staticSide = {
                top: 'bottom',
                right: 'left',
                bottom: 'top',
                left: 'right',
            }[placement.split('-')[0]];
            Object.assign(this.arrowEl.style, {
                left: arrowX != null ? `${arrowX}px` : '',
                top: arrowY != null ? `${arrowY}px` : '',
                right: '',
                bottom: '',
                [staticSide]: '-4px',
            });
        });
    }
    render() {
        return (h(Host, { key: 'ce9cb2211743e50c83b7f572b2e9dc5b02fa3ac8' }, h("span", { key: '74f73894f5a62519b3bf8c03a83e7102092ccd5c', part: "trigger", id: "trigger", ref: (el) => (this.triggerEl = el) }, h("slot", { key: '4551b2a438b1c57ca68e4a2973529186063a13c2' })), h("div", { key: 'e3dd196c6ee225cb363bcf54d35836ff17ed5969', part: "tooltip", class: "tooltip", id: "tooltip", role: "tooltip", ref: (el) => (this.tooltipEl = el) }, h("div", { key: '4eb8bb3af588160018ef9d8899afc09edf4b195d', id: "arrow", ref: (el) => (this.arrowEl = el), part: "arrow" }), this.label, h("slot", { key: 'c427ef3ef9953b764f9b1adcb4a8b7eee1fe91cd', name: "tooltip" }))));
    }
    static get watchers() { return {
        "open": [{
                "openChanged": 0
            }]
    }; }
};
RtkMenu.style = rtkTooltipCss();

export { RtkAvatar as rtk_avatar, RtkButton as rtk_button, RtkChat as rtk_chat, RtkChatComposerView as rtk_chat_composer_view, RtkChatHeader as rtk_chat_header, RtkChatMessagesUiPaginated as rtk_chat_messages_ui_paginated, RtkChatSelector as rtk_chat_selector, RtkDraftAttachmentView as rtk_draft_attachment_view, RtkEmojiPicker as rtk_emoji_picker, RtkEmojiPickerButton as rtk_emoji_picker_button, RtkFileMessageView as rtk_file_message_view, RtkFilePickerButton as rtk_file_picker_button, RtkIcon as rtk_icon, RtkImageMessageView as rtk_image_message_view, RtkMarkdownView as rtk_markdown_view, RtkMeeting as rtk_meeting, RtkMenu$1 as rtk_menu, RtkMenuItem as rtk_menu_item, RtkMenuList as rtk_menu_list, RtkMessageView as rtk_message_view, RtkPaginatedList as rtk_paginated_list, RtkPinnedMessageSelector as rtk_pinned_message_selector, RtkSpinner as rtk_spinner, RtkTextComposerView as rtk_text_composer_view, RtkTextMessageView as rtk_text_message_view, RtkMenu as rtk_tooltip };

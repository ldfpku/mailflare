import { r as registerInstance, d as createEvent, e as writeTask, h, a as Host } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage } from './ui-store-CkvSNsmd.js';
import { g as getAllConnectedParticipants, p as participantIdentifier } from './breakout-rooms-Daj_55_i.js';
import { f as formatName, a as shorten } from './string-vBD2htwQ.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';

const rtkBreakoutRoomManagerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));border-radius:var(--rtk-border-radius-sm, 4px)}@keyframes bg-glow{25%{background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.2)}50%{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}75%{background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.2)}}.glowing-card{animation:bg-glow 0.8s}.selector-mode,.assign-mode{display:flex;flex-direction:column;align-items:center;padding:var(--rtk-space-2, 8px);cursor:pointer}.selector:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.show-on-hover{display:none}.header{width:100%;display:flex;align-items:center}.header rtk-icon{margin-left:var(--rtk-space-2, 8px);height:var(--rtk-space-5, 20px);cursor:pointer}.header .danger{--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}.header .hide{display:none}.header .rooms-container{display:flex;flex-grow:1;flex-direction:row;align-items:center;justify-content:flex-end}.header input{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));padding:var(--rtk-space-1, 4px);color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));max-width:var(--rtk-space-36, 144px);font-size:14px;font-weight:500;border-radius:var(--rtk-border-radius-sm, 4px);border-width:var(--rtk-border-width-none, 0);border-style:none;outline:2px solid transparent;outline-offset:2px;border-bottom-width:var(--rtk-border-width-sm, 1px);border-style:solid;--tw-border-opacity:1;border-bottom-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-border-opacity))}.header input:disabled{overflow-x:visible;border-radius:var(--rtk-border-radius-none, 0);border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:transparent}.header input:invalid{border-bottom-width:var(--rtk-border-width-sm, 1px);border-style:dashed;--tw-border-opacity:1;border-bottom-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-border-opacity))}.header input.editing-enabled{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity))}.header .participant-count{display:flex;align-items:center;font-size:14px;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88))}.header .participant-count rtk-icon{margin:var(--rtk-space-0, 0px);margin-right:var(--rtk-space-0\\.5, 2px);width:var(--rtk-space-3, 12px)}.header .assign-button{height:var(--rtk-space-6, 24px);--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-text-opacity));text-decoration-line:underline}.header .assign-button:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.participant-list{display:grid;flex-grow:1;grid-template-columns:repeat(2, minmax(0, 1fr));gap:var(--rtk-space-2, 8px);margin-top:var(--rtk-space-2, 8px);margin-bottom:var(--rtk-space-2, 8px);width:100%;border-radius:var(--rtk-border-radius-sm, 4px)}.participant-list::-webkit-scrollbar{width:var(--rtk-space-1\\.5, 6px)}.participant-list::-webkit-scrollbar-thumb{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.participant-list::-webkit-scrollbar-track{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.participant-item{display:flex;align-items:center;justify-content:space-between;margin-right:var(--rtk-space-2, 8px);height:-moz-fit-content;height:fit-content;padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px)}.participant-item:hover{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.selector-mode:hover .show-on-hover{display:flex}.message-container{margin:var(--rtk-space-0, 0px);display:flex;width:100%;padding-top:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-2, 8px)}.message-container p{margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-0, 0px);height:var(--rtk-space-20, 80px);display:flex;width:100%;align-items:center;justify-content:center;border-radius:var(--rtk-border-radius-sm, 4px);font-size:12px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64));border-style:dashed;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity))}.message-container p:hover{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-border-opacity));background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.25)}.message-container .drop-zone-active{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-border-opacity));background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.25)}rtk-icon{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}.show-on-hover{margin-left:var(--rtk-space-4, 16px);height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px);display:none}:host(:hover) .show-on-hover{display:flex}.peer-ui-container{position:relative;display:flex;align-items:center;gap:var(--rtk-space-2, 8px);height:var(--rtk-space-10, 40px);cursor:pointer;border-radius:var(--rtk-border-radius-sm, 4px);color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88))}.peer-ui-container rtk-avatar{height:var(--rtk-space-7, 28px);width:var(--rtk-space-7, 28px);font-size:14px;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.peer-ui-container .name{font-size:14px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}`;

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
const ROOM_TITLE_MIN_CHARS = 3;
const RtkBreakoutRoomManager = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onParticipantsAdd = createEvent(this, "participantsAdd", 7);
        this.onParticipantDelete = createEvent(this, "participantDelete", 7);
        this.onRoomJoin = createEvent(this, "roomJoin", 7);
        this.deleteRoom = createEvent(this, "delete", 7);
        this.updateRoom = createEvent(this, "update", 7);
        /** allow room delete */
        this.allowDelete = true;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Drag mode */
        this.isDragMode = false;
        /** display expanded card by default */
        this.defaultExpanded = false;
        this.editingTitleRoomId = null;
        this.newTitle = null;
        this.showExpandedCard = false;
        this.glowingCard = false;
        this.permissionsUpdateListener = () => {
            this.permissions = this.meeting.self.permissions.connectedMeetings;
        };
        this.reset = () => {
            this.editingTitleRoomId = null;
            this.newTitle = null;
        };
        this.onEditClick = () => {
            if (this.editingTitleRoomId) {
                if (this.newTitle.length < ROOM_TITLE_MIN_CHARS)
                    return;
                this.roomTitle = this.newTitle;
                this.updateRoom.emit({
                    title: this.newTitle,
                    id: this.editingTitleRoomId,
                });
                this.glowCard();
                this.reset();
            }
            else {
                this.editingTitleRoomId = this.room.id;
                writeTask(() => {
                    this.inputTextEl.focus();
                    this.inputTextEl.select();
                });
            }
        };
        this.onDrop = (e) => {
            if (e.currentTarget instanceof HTMLParagraphElement) {
                e.currentTarget.classList.remove('drop-zone-active');
                this.onAssign();
            }
        };
        this.onDragOver = (e) => {
            if (e.currentTarget instanceof HTMLParagraphElement) {
                e.currentTarget.classList.add('drop-zone-active');
                e.preventDefault();
            }
        };
    }
    connectedCallback() {
        var _a;
        this.allParticipants = getAllConnectedParticipants(this.meeting);
        this.permissionsUpdateListener();
        this.showExpandedCard = this.defaultExpanded;
        this.roomTitle = this.room.isParent ? this.t('breakout_rooms.main_room') : (_a = this.room) === null || _a === void 0 ? void 0 : _a.title;
        this.canEditMeetingTitle =
            this.permissions.canAlterConnectedMeetings &&
                !this.room.isParent &&
                !this.meeting.connectedMeetings.isActive; // TODO: remove this once socket supports update meetings
        this.meeting.self.permissions.on('permissionsUpdate', this.permissionsUpdateListener);
    }
    disconnectedCallback() {
        this.meeting.self.permissions.off('permissionsUpdate', this.permissionsUpdateListener);
    }
    onDragLeave(e) {
        if (e.currentTarget instanceof HTMLParagraphElement) {
            e.currentTarget.classList.remove('drop-zone-active');
        }
    }
    getAssignmentHint() {
        if (this.assigningParticipants && this.isDragMode) {
            return this.t('breakout_rooms.drag_drop_participants');
        }
        if (this.assigningParticipants) {
            return this.t('breakout_rooms.click_drop_participants');
        }
        if (this.room.participants.length === 0) {
            return this.t('breakout_rooms.none_assigned');
        }
    }
    toggleCardDisplay() {
        this.showExpandedCard = !this.showExpandedCard;
    }
    glowCard() {
        this.glowingCard = true;
        setTimeout(() => {
            this.glowingCard = false;
        }, 2000);
    }
    onAssign() {
        this.onParticipantsAdd.emit();
        this.glowCard();
    }
    onJoin() {
        this.onRoomJoin.emit();
    }
    onTitleChanged(e) {
        if (e.key === 'Enter') {
            this.newTitle = e.target.value;
            this.onEditClick();
        }
    }
    renderPeer(participant) {
        const { displayPictureUrl: picture } = this.allParticipants.find((p) => participantIdentifier(p) === participantIdentifier(participant));
        const name = formatName(participant.displayName || '');
        return (h("div", { class: "peer-ui-container" }, h("rtk-avatar", { participant: { name, picture }, size: "sm" }), h("p", { class: "name", title: name }, shorten(name, 16), this.meeting.self.userId === participant.id && ` (${this.t('you')})`)));
    }
    renderExpandedCardMaybe() {
        if (!this.showExpandedCard)
            return;
        if (this.room.isParent)
            return;
        if (!this.getAssignmentHint())
            return;
        if (!this.permissions.canAlterConnectedMeetings)
            return;
        return (h("div", { class: "message-container" }, h("p", { class: { 'compact-height': this.room.participants.length !== 0 }, onClick: () => this.onAssign(), onDragOver: this.onDragOver, onDragLeave: this.onDragLeave, onDrop: this.onDrop }, this.getAssignmentHint())));
    }
    renderParticipantsMaybe() {
        if (!this.showExpandedCard)
            return;
        if (this.room.isParent)
            return;
        if (this.room.participants.length === 0)
            return;
        return (h("div", { class: "participant-list", onClick: () => {
                this.onAssign();
            } }, this.room.participants.map((participant) => (h("div", { class: "participant-item", role: "listitem", key: participant.id }, this.renderPeer(participant), this.permissions.canAlterConnectedMeetings && (h("rtk-icon", { class: "show-on-hover", icon: this.iconPack.dismiss, onClick: () => {
                this.onParticipantDelete.emit(participant);
            } })))))));
    }
    render() {
        var _a, _b, _c;
        if (!this.meeting || !this.room || !this.permissions)
            return null;
        /* NOTE(ravindra-cloudflare):
         *  Checking if user can switch to this room
         *  Check 1: if user has full access.
         *  Check 2: For non-parent room, user has "switch meeting" access.
         *  Check 3: For parent room, user has "switch to parent meeting" access.
         */
        const canSwitchToThisRoom = this.permissions.canAlterConnectedMeetings ||
            (this.permissions.canSwitchConnectedMeetings && !this.room.isParent) ||
            (this.permissions.canSwitchToParentMeeting && this.room.isParent);
        return (h(Host, null, h("div", { class: {
                'assign-mode': this.assigningParticipants,
                'selector-mode': !this.assigningParticipants,
                'glowing-card': this.glowingCard,
            } }, h("div", { class: "header" }, h("input", { ref: (el) => (this.inputTextEl = el), placeholder: this.t('breakout_rooms.room_name'), disabled: !(this.editingTitleRoomId === this.room.id), value: this.roomTitle, minlength: ROOM_TITLE_MIN_CHARS, onChange: (e) => {
                this.newTitle = e.target.value;
            }, onKeyPress: (e) => this.onTitleChanged(e), class: { 'editing-enabled': this.editingTitleRoomId === this.room.id }, style: { width: `${this.roomTitle.length + 1}ch` } }), this.editingTitleRoomId !== this.room.id && (h("span", { class: "participant-count" }, "(", h("rtk-icon", { icon: this.iconPack.people }), (_c = (_b = (_a = this.room) === null || _a === void 0 ? void 0 : _a.participants) === null || _b === void 0 ? void 0 : _b.length) !== null && _c !== void 0 ? _c : '0', ")")), this.canEditMeetingTitle && (h("rtk-tooltip", { label: this.editingTitleRoomId === this.room.id
                ? this.t('breakout_rooms.save_room_name')
                : this.t('breakout_rooms.edit_room_name') }, h("rtk-icon", { icon: this.editingTitleRoomId === this.room.id
                ? this.iconPack.checkmark
                : this.iconPack.edit, class: "show-on-hover", onClick: this.onEditClick }))), h("div", { class: "rooms-container" }, this.permissions.canAlterConnectedMeetings &&
            !this.room.isParent &&
            this.allowDelete && (h("rtk-tooltip", { label: this.t('breakout_rooms.delete'), class: "danger" }, h("rtk-icon", { icon: this.iconPack.delete, class: "show-on-hover", onClick: () => {
                this.deleteRoom.emit();
            } }))), this.assigningParticipants &&
            this.permissions.canAlterConnectedMeetings &&
            !this.room.isParent && (h("rtk-button", { kind: "button", variant: "ghost", class: "assign-button", size: "md", onClick: () => this.onAssign() }, this.t('breakout_rooms.assign'))), this.mode === 'edit' && !this.assigningParticipants && canSwitchToThisRoom && (h("rtk-button", { kind: "button", variant: "ghost", class: "assign-button", size: "md", disabled: this.room.id === this.meeting.meta.meetingId, onClick: () => this.onJoin() }, this.room.id === this.meeting.meta.meetingId ? this.t('joined') : this.t('join'))), !this.room.isParent && (h("rtk-icon", { icon: this.showExpandedCard ? this.iconPack.chevron_up : this.iconPack.chevron_down, onClick: () => this.toggleCardDisplay() })))), this.renderExpandedCardMaybe(), this.renderParticipantsMaybe())));
    }
};
__decorate$2([
    SyncWithStore()
], RtkBreakoutRoomManager.prototype, "meeting", void 0);
__decorate$2([
    SyncWithStore()
], RtkBreakoutRoomManager.prototype, "states", void 0);
__decorate$2([
    SyncWithStore()
], RtkBreakoutRoomManager.prototype, "iconPack", void 0);
__decorate$2([
    SyncWithStore()
], RtkBreakoutRoomManager.prototype, "t", void 0);
RtkBreakoutRoomManager.style = rtkBreakoutRoomManagerCss();

const rtkBreakoutRoomParticipantsCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{display:flex;height:100%;flex-direction:column;font-size:14px}:host input[type='checkbox']{margin:var(--rtk-space-0, 0px);cursor:pointer;-webkit-appearance:none;-moz-appearance:none;appearance:none;border-radius:var(--rtk-border-radius-sm, 4px);position:relative;height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px);border-width:var(--rtk-border-width-sm, 1px);border-style:solid;border-color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}:host input[type='checkbox']:checked{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-border-opacity));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity))}:host input[type='checkbox']:checked::before{position:absolute;top:1px;left:1px;height:var(--rtk-space-3, 12px);width:var(--rtk-space-3, 12px);background-color:rgb(var(--rtk-colors-text-1000, 255 255 255));content:'';clip-path:polygon(5% 60%, 35% 93%, 100% 19%, 86% 4%, 36% 62%, 19% 44%)}*{box-sizing:border-box}.participants{margin-top:var(--rtk-space-2, 8px);padding:var(--rtk-space-0, 0px)}.ctr{box-sizing:border-box;padding-top:var(--rtk-space-0, 0px);padding-bottom:var(--rtk-space-0, 0px);overflow-y:auto;flex-grow:1;flex-basis:0}.empty-message{margin-top:var(--rtk-space-10, 40px);margin-bottom:var(--rtk-space-10, 40px);text-align:center;font-size:14px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.empty-room{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:var(--rtk-space-2, 8px);height:100%;text-align:center;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.empty-room rtk-icon{height:var(--rtk-space-7, 28px);width:var(--rtk-space-7, 28px)}.empty-room p{font-size:16px;font-weight:500;margin:var(--rtk-space-0, 0px)}.empty-room span{font-size:12px;color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.search-wrapper{margin-bottom:var(--rtk-space-1, 4px);display:flex;align-items:center;gap:var(--rtk-space-2, 8px)}.search{position:sticky;box-sizing:border-box;display:flex;align-items:center;border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-0, 0px);height:var(--rtk-space-8, 32px)}.search .search-icon{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-2, 8px);height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px);color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.search input{box-sizing:border-box;width:100%;padding-right:var(--rtk-space-2, 8px);border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:inherit;color:rgb(var(--rtk-colors-text-1000, 255 255 255));outline:2px solid transparent;outline-offset:2px;border-radius:var(--rtk-border-radius-sm, 4px);font-size:14px}.search input::-moz-placeholder{color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.search input::placeholder{color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.header{margin-left:var(--rtk-space-2, 8px);margin-right:var(--rtk-space-1\\.5, 6px);height:var(--rtk-space-9, 36px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);padding-right:var(--rtk-space-0\\.5, 2px);border-bottom-width:var(--rtk-border-width-sm, 1px);border-top-width:var(--rtk-border-width-none, 0);border-right-width:var(--rtk-border-width-none, 0);border-left-width:var(--rtk-border-width-none, 0);border-style:solid;--tw-border-opacity:1;border-bottom-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity));font-size:12px;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));display:flex;align-items:center;justify-content:space-between}.title-wrapper{display:flex;align-items:center;gap:var(--rtk-space-2, 8px)}.participant-count{display:flex;align-items:center;font-size:14px}.participant-count rtk-icon{margin-right:var(--rtk-space-0\\.5, 2px);width:var(--rtk-space-3, 12px)}.participant-item{display:flex;align-items:center;justify-content:space-between;margin-top:var(--rtk-space-1, 4px);margin-bottom:var(--rtk-space-1, 4px);border-radius:var(--rtk-border-radius-sm, 4px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);cursor:pointer}.participant-item input.hide-checkbox{display:none}.participant-item input:checked{display:inline-block}.dragging input{display:none}.participant-item:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.participant-item:hover input{display:inline-block}.peer-ui-container{position:relative;display:flex;align-items:center;gap:var(--rtk-space-2, 8px);height:var(--rtk-space-10, 40px);cursor:pointer;border-radius:var(--rtk-border-radius-sm, 4px);color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64))}.peer-ui-container rtk-avatar{height:var(--rtk-space-7, 28px);width:var(--rtk-space-7, 28px);font-size:14px;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.peer-ui-container .name{font-size:14px;overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}`;

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
const RtkBreakoutRoomParticipants = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onSelectedParticipantsUpdate = createEvent(this, "selectedParticipantsUpdate", 7);
        this.onAllToggled = createEvent(this, "allParticipantsToggleUpdate", 7);
        this.onParticipantsDragging = createEvent(this, "participantsDragging", 7);
        /** Participant ids */
        this.participantIds = [];
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.search = '';
        this.participantsToShow = [];
        /** selected participants */
        this.selectedParticipantIds = [];
        this.isDragging = false;
        this.onSearchInput = (e) => {
            this.search = e.target.value;
        };
        this.onDragStart = (participant) => {
            this.isDragging = true;
            this.onParticipantsDragging.emit(true);
            this.updateSelectedParticipants(participant, true);
        };
        this.onDragEnd = (participant) => {
            this.isDragging = false;
            this.onParticipantsDragging.emit(false);
            this.updateSelectedParticipants(participant, false);
        };
        this.onClick = (participant) => {
            const selected = this.selectedParticipantIds.includes(participantIdentifier(participant));
            this.updateSelectedParticipants(participant, !selected);
        };
        this.onToggleAll = (checked) => {
            const selectedParticipants = checked ? this.participantsToShow.map(participantIdentifier) : [];
            this.onAllToggled.emit(selectedParticipants);
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
        this.searchChanged(this.search);
    }
    disconnectedCallback() {
        if (!this.meeting)
            return;
    }
    updateSelectedParticipants(participant, selected) {
        const id = participantIdentifier(participant);
        let selectedParticipants = [];
        if (selected && !this.selectedParticipantIds.includes(id)) {
            selectedParticipants = [...this.selectedParticipantIds, id];
        }
        else {
            selectedParticipants = [...this.selectedParticipantIds.filter((x) => x !== id)];
        }
        this.onSelectedParticipantsUpdate.emit(selectedParticipants);
    }
    meetingChanged(meeting) {
        if (!meeting)
            return;
        this.getParticipants(this.search);
    }
    participantsChanged() {
        this.getParticipants(this.search);
    }
    searchChanged(search) {
        this.getParticipants(search);
    }
    getParticipants(search) {
        const allParticipants = getAllConnectedParticipants(this.meeting);
        this.participantsToShow = allParticipants.filter((participant) => {
            var _a;
            return (this.participantIds.includes(participantIdentifier(participant)) &&
                ((_a = participant.displayName) !== null && _a !== void 0 ? _a : '').toLowerCase().includes(search.toLowerCase()));
        });
    }
    renderPeer(participant) {
        const name = formatName(participant.displayName || '');
        return (h("div", { class: "peer-ui-container" }, h("rtk-avatar", { participant: {
                name: participant.displayName,
                picture: participant.displayPictureUrl,
            }, size: "sm" }), h("p", { class: "name", title: name }, shorten(name, 16), this.meeting.self.userId === participant.id && ` (${this.t('you')})`)));
    }
    render() {
        return (h(Host, { key: '94cb6d982e09320de84247ed54125112bd3e13d3' }, h("div", { key: '209bf3e3aab27fa05592bb24242bd6b4d0311437', class: "search-wrapper" }, h("div", { key: 'a827dcb5f643d421e6974f37f61b9d491332467f', class: "search", part: "search" }, h("rtk-icon", { key: 'cf06dfdf881b67faeff7c99445eb96994e73c87f', icon: this.iconPack.search, part: "search-icon", class: "search-icon" }), h("input", { key: 'd70fda9e533d770f1e03735ff7f1a69a49e8e8ad', type: "search", autocomplete: "off", placeholder: this.t('search'), onInput: this.onSearchInput, part: "search-input" })), h("slot", { key: '14ae3d89ee242081fdbc953b4c5b6416c873933f', name: "shuffle-button" })), h("div", { key: 'c86217a6ccf23ce29d6cf366be8c401556f5b72e', class: "header" }, h("div", { key: '217d658e89b4647628fb826d11dd05bcf9ac892f', class: "title-wrapper" }, h("span", { key: '7fa37a9e42871c36543f2107a872f1e14fb03bb8' }, this.t('breakout_rooms.main_room')), h("span", { key: '956a5b53d06dea779b1bd00df955f653ea26202f', class: "participant-count" }, "(", h("rtk-icon", { key: '9f9de13fc327edc1f90beddbf1edefb70bcedbe0', icon: this.iconPack.people }), this.participantsToShow.length, ")")), this.selectedParticipantIds.length !== 0 && (h("rtk-tooltip", { key: 'abc39eba7b381b8beae1ecc6d6afda27ba37975a', label: this.t('breakout_rooms.select_all') }, h("input", { key: '5e5dfa6c0f68a80b58d44d8b2be8d31c5c22bc69', type: "checkbox", checked: this.selectedParticipantIds.length === this.participantsToShow.length, onChange: (e) => this.onToggleAll(!!e.target.checked) })))), h("div", { key: 'fcb0a2ceac16b68948d3f93ddc0f6f9e2542d6d8', class: "ctr scrollbar", part: "container" }, this.participantsToShow.length > 0 && (h("ul", { key: '19916d9d462370718445dfb01a23d2806a57f1ff', class: "participants", part: "participants" }, this.participantsToShow.map((participant) => (h("li", { class: { 'participant-item': true, dragging: this.isDragging }, onClick: () => this.onClick(participant), onDragStart: () => this.onDragStart(participant), onDragEnd: () => this.onDragEnd(participant), draggable: this.selectedParticipantIds.length === 0, role: "listitem", key: participant.id }, this.renderPeer(participant), !this.isDragging && (h("input", { type: "checkbox", class: {
                'hide-checkbox': this.selectedParticipantIds.length === 0,
            }, checked: this.selectedParticipantIds.includes(participantIdentifier(participant)) }))))))), this.participantsToShow.length === 0 && this.search.length > 0 && (h("div", { key: '2b0898cb78599610406ff0ec2b2be0ef8c4615cf', class: "empty-message" }, this.t('participants.errors.empty_results'))), this.participantsToShow.length === 0 && this.search.length === 0 && (h("div", { key: 'f6bdab6034aa82bf26dfa1a08615d36dcd00dcf6', class: "empty-room" }, h("rtk-icon", { key: '115e987588beb229aba15dffbd05ffbef71cb74c', icon: this.iconPack.people_checked, part: "search-icon", class: "search-icon" }), h("p", { key: 'd8b6120c1361b97d1e73969d9da119aa7488a7b3' }, this.t('breakout_rooms.all_assigned')), h("span", { key: '020aa6e5440976f89960b0972784c997a1f765a8' }, this.t('breakout_rooms.empty_main_room')))))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "participantIds": [{
                "participantsChanged": 0
            }],
        "search": [{
                "searchChanged": 0
            }]
    }; }
};
__decorate$1([
    SyncWithStore()
], RtkBreakoutRoomParticipants.prototype, "meeting", void 0);
__decorate$1([
    SyncWithStore()
], RtkBreakoutRoomParticipants.prototype, "iconPack", void 0);
__decorate$1([
    SyncWithStore()
], RtkBreakoutRoomParticipants.prototype, "t", void 0);
RtkBreakoutRoomParticipants.style = rtkBreakoutRoomParticipantsCss();

const rtkCounterCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;flex-direction:row;align-items:center;justify-content:center;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));width:-moz-fit-content;width:fit-content;border-radius:var(--rtk-border-radius-sm, 4px);padding:var(--rtk-space-1, 4px)}p{margin:var(--rtk-space-0, 0px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px)}input{margin:var(--rtk-space-0, 0px);width:var(--rtk-space-6, 24px);padding:var(--rtk-space-2, 8px);border-width:var(--rtk-border-width-sm, 1px);border-style:solid;border-color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));text-align:center;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));border-radius:var(--rtk-border-radius-sm, 4px);font-size:16px;outline:2px solid transparent;outline-offset:2px;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms}input::-webkit-outer-spin-button,input::-webkit-inner-spin-button{margin:var(--rtk-space-0, 0px);appearance:none;-webkit-appearance:none}input[type='number']{-moz-appearance:textfield}`;

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
const RtkCounter = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.onChange = createEvent(this, "valueChange", 7);
        /** Input */
        this.input = '1';
        /** Minimum value */
        this.minValue = 0;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
    }
    connectedCallback() {
        this.watchStateHandler(this.input);
        this.input = this.value.toString();
    }
    watchStateHandler(input) {
        this.onChange.emit(input);
    }
    increment() {
        this.input = Math.max(parseInt(this.input) + 1, this.minValue).toString();
    }
    decrement() {
        this.input = Math.max(this.minValue, parseInt(this.input) - 1).toString();
    }
    render() {
        return (h(Host, { key: 'ded6fcf73ce9b011ca2a005cce767c9180d9fa7f' }, h("rtk-button", { key: '29a016773f430a03572a58a21f61495baabcaae7', kind: "icon", variant: "ghost", onClick: () => this.decrement() }, h("rtk-icon", { key: '75dab16bd637f72e2ea1dc932e19b0e38d220caa', icon: this.iconPack.subtract })), h("input", { key: '335b77366096033514acb4421f3e6b774392b900', type: "number", value: this.input, min: this.minValue, onInput: (e) => {
                const val = parseInt(e.target.value, 10);
                if (isNaN(val) || val < this.minValue) {
                    this.input = this.minValue.toString();
                }
                else {
                    this.input = val.toString();
                }
            } }), h("rtk-button", { key: '47d300cb7857a37467f7f2a4a5b5004b4fa91356', kind: "icon", variant: "ghost", onClick: () => this.increment() }, h("rtk-icon", { key: '4febc41d26a2c5afff18ec136f325e97a699b3f5', icon: this.iconPack.add }))));
    }
    static get watchers() { return {
        "input": [{
                "watchStateHandler": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkCounter.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkCounter.prototype, "t", void 0);
RtkCounter.style = rtkCounterCss();

export { RtkBreakoutRoomManager as rtk_breakout_room_manager, RtkBreakoutRoomParticipants as rtk_breakout_room_participants, RtkCounter as rtk_counter };

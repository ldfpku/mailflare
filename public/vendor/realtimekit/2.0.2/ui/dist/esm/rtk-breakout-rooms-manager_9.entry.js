import { r as registerInstance, d as createEvent, h, a as Host } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, c as createDefaultConfig } from './ui-store-CkvSNsmd.js';
import { p as participantIdentifier, r as resetRoomCount } from './breakout-rooms-Daj_55_i.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { B as BreakoutRoomsManager } from './breakout-rooms-manager-B1Qky9zO.js';
import { R as Render } from './index-BUsisVB6.js';

const rtkBreakoutRoomsManagerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.color-brand{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity))}.color-danger{--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}.loading-content{height:var(--rtk-space-60, 240px);width:var(--rtk-space-96, 384px);padding:var(--rtk-space-9, 36px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));display:flex;align-items:center;justify-content:center}.room-config{overflow:hidden;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));display:flex;flex-direction:column;width:var(--rtk-space-96, 384px);padding-left:var(--rtk-space-9, 36px);padding-right:var(--rtk-space-9, 36px);padding-top:var(--rtk-space-10, 40px);padding-bottom:var(--rtk-space-10, 40px)}header{margin-bottom:var(--rtk-space-8, 32px);display:flex;align-items:center;gap:var(--rtk-space-2, 8px);font-size:24px;font-weight:600}header rtk-icon{height:var(--rtk-space-7, 28px);width:var(--rtk-space-7, 28px)}.create-room{margin-bottom:var(--rtk-space-4, 16px);display:flex;align-items:center;gap:var(--rtk-space-3, 12px);width:100%}.create-room p{margin:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-1, 4px);font-size:16px}.distribution-hint{margin-bottom:var(--rtk-space-8, 32px);font-size:14px;font-weight:400;color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.distribution-hint em{font-style:normal;color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}footer{display:flex;flex-direction:row;vertical-align:middle;justify-content:center}footer rtk-button{width:100%;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}label{margin-bottom:var(--rtk-space-3, 12px);font-weight:400;color:rgb(var(--rtk-colors-text-1000, 255 255 255));opacity:0.4}.participant-config-wrapper{width:850px;min-height:595px;max-width:100%;max-height:100%;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));display:flex;flex-direction:column}.participant-config-actions{display:flex;justify-content:space-between;padding-left:var(--rtk-space-8, 32px);padding-right:var(--rtk-space-8, 32px);padding-top:var(--rtk-space-5, 20px);padding-bottom:var(--rtk-space-5, 20px);border-bottom-right-radius:var(--rtk-border-radius-md, 8px);border-bottom-left-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}.participant-config{display:flex;flex-grow:1;flex-direction:row;overflow:hidden}aside{box-sizing:border-box;display:flex;width:var(--rtk-space-96, 384px);flex-grow:1;flex-direction:column;padding-left:var(--rtk-space-8, 32px);padding-right:var(--rtk-space-4, 16px);border-right-width:var(--rtk-border-width-sm, 1px);border-top-width:var(--rtk-border-width-none, 0);border-bottom-width:var(--rtk-border-width-none, 0);border-left-width:var(--rtk-border-width-none, 0);border-style:solid;--tw-border-opacity:1;border-right-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-border-opacity))}aside header{margin-bottom:var(--rtk-space-4, 16px);width:100%;padding-left:var(--rtk-space-0, 0px);padding-right:var(--rtk-space-0, 0px);padding-top:var(--rtk-space-8, 32px);font-size:20px;font-weight:500;line-height:2rem}.shuffle-button{display:flex;flex-direction:row;align-items:center}.shuffle-button rtk-icon{height:var(--rtk-space-8, 32px)}.participants-assign-actions{display:flex;flex-direction:row;align-items:center;justify-content:space-between;font-size:14px;padding-left:var(--rtk-space-8, 32px);padding-right:var(--rtk-space-2, 8px);margin-left:calc(var(--rtk-space-8, 32px) * -1);margin-right:calc(var(--rtk-space-4, 16px) * -1);padding-top:var(--rtk-space-0\\.5, 2px);padding-bottom:var(--rtk-space-0\\.5, 2px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.participants-assign-actions .deselect-button{height:var(--rtk-space-6, 24px)}.participants-assign-actions .deselect-button:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.assign-rooms{padding:var(--rtk-space-8, 32px);display:flex;width:100%;flex-direction:column}.assign-rooms .disabled{opacity:0.2}.assign-rooms .back{display:flex;cursor:pointer;flex-direction:row;align-items:center;justify-content:flex-start;padding:var(--rtk-space-4, 16px);padding-bottom:var(--rtk-space-0, 0px);font-size:14px;color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}.assign-rooms .back rtk-icon{height:var(--rtk-space-5, 20px)}.assign-rooms .row{display:flex;flex-direction:row;align-items:center;justify-content:flex-start;gap:var(--rtk-space-3, 12px);margin-bottom:var(--rtk-space-4, 16px);font-size:14px}.assign-rooms .row-header{margin:var(--rtk-space-0, 0px);font-size:16px;line-height:2rem}.assign-rooms .cta-buttons{display:flex;align-items:center;justify-content:flex-start;gap:var(--rtk-space-2, 8px)}.assign-rooms .cta-buttons rtk-button div{display:flex;flex-direction:row;align-items:center}.assign-rooms .cta-buttons rtk-button div rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px)}.rooms{margin-bottom:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-1, 4px);display:flex;flex-grow:1;flex-direction:column;gap:var(--rtk-space-2, 8px);overflow-y:auto;max-height:500px}.rooms::-webkit-scrollbar{width:var(--rtk-space-1\\.5, 6px);border-radius:var(--rtk-border-radius-sm, 4px)}.rooms::-webkit-scrollbar-thumb{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.rooms::-webkit-scrollbar-track{border-radius:var(--rtk-border-radius-sm, 4px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.breakout-actions{display:flex;flex-direction:row;align-items:center;justify-content:flex-end;gap:var(--rtk-space-2, 8px)}.breakout-actions .start-breakout-button{color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.breakout-actions .close-breakout-button{color:rgb(var(--rtk-colors-text-1000, 255 255 255));--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-bg-opacity))}.breakout-actions .update-breakout-button{background-color:transparent;--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-text-opacity));border-width:var(--rtk-border-width-sm, 1px);border-style:solid;--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-border-opacity))}.status-bar{display:flex;align-items:center;font-size:14px;color:rgb(var(--rtk-colors-text-700, 255 255 255 / 0.64));width:var(--rtk-space-80, 320px)}.ephemeral-status{--tw-text-opacity:1;color:rgba(var(--rtk-colors-success, 98 165 4) / var(--tw-text-opacity))}.ephemeral-status rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px)}.room-switcher-container{border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));width:468px;padding:var(--rtk-space-8, 32px)}.add-room-jumbo-btn div{display:flex;align-items:center;gap:var(--rtk-space-1, 4px);font-size:14px;--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity))}.add-room-jumbo-btn div rtk-icon{height:var(--rtk-space-4, 16px);width:var(--rtk-space-4, 16px)}.br-primary-btn:not([disabled]){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.br-primary-btn:not([disabled]):hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-bg-opacity))}.br-secondary-btn:not([disabled]){--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.br-secondary-btn:not([disabled]):hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}`;

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
const MIN_ROOMS = 1;
const RtkBreakoutRoomsManager = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Flag to indicate busy state */
        this.loading = false;
        /** Breakout room config object */
        this.roomConfig = {
            rooms: 2,
            step: 'room-config',
            mode: 'create',
            applyingChanges: false,
        };
        /** List of assigned participants */
        // @State() unassignedParticipants: string[] = [];
        /** Flag that tells if participants are being assigned or not */
        this.assigningParticipants = false;
        /** List of selected peers */
        this.selectedParticipants = [];
        /** update about room changes */
        this.ephemeralStatusText = '';
        /** Flag that tells if participants are being dragged */
        this.isDragMode = false;
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.permissionsUpdateListener = () => {
            this.permissions = this.meeting.self.permissions.connectedMeetings;
        };
        this.updateLocalState = (payload) => {
            this.stateManager.updateCurrentState(payload);
            this.draftState = this.stateManager.currentState;
            if (this.meeting.connectedMeetings.isActive) {
                this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { mode: 'edit' });
            }
            if (this.roomConfig.mode === 'create' && !this.meeting.connectedMeetings.isActive) {
                resetRoomCount();
            }
            if (['edit', 'view'].includes(this.roomConfig.mode)) {
                this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { rooms: payload.meetings.length, step: 'participants-config' });
                this.selectedParticipants = [];
            }
        };
        this.onAddNewRoom = () => {
            this.stateManager.addNewMeeting();
            this.draftState = this.stateManager.currentState;
            this.selectorRef.scrollTo({ top: this.selectorRef.scrollHeight, behavior: 'smooth' });
        };
        this.onRoomUpdate = (event) => {
            const { detail } = event;
            this.stateManager.updateMeetingTitle(detail.id, detail.title);
            this.draftState = this.stateManager.currentState;
        };
        this.onRoomDelete = (id) => {
            const toDelete = this.stateManager.allConnectedMeetings.find((meeting) => meeting.id === id);
            if (toDelete) {
                this.stateManager.deleteMeeting(id);
                this.draftState = this.stateManager.currentState;
            }
        };
        this.unassignParticipant = (id) => {
            this.stateManager.unassignParticipants([id]);
            this.draftState = this.stateManager.currentState;
        };
        this.onUnassignAll = () => {
            this.stateManager.unassignAllParticipants();
            this.draftState = this.stateManager.currentState;
        };
        this.assignParticipantsToRoom = (destinationMeetingId) => {
            if (this.selectedParticipants.length === 0 || this.assigningParticipants == false)
                return;
            this.stateManager.assignParticipantsToMeeting(this.selectedParticipants, destinationMeetingId);
            this.draftState = this.stateManager.currentState;
            this.selectedParticipants = [];
            this.assigningParticipants = false;
            this.setEphemeralStatus(this.t('breakout_rooms.ephemeral_status.participants_assigned'));
        };
        this.handleClose = (stateUpdate, store) => {
            stateUpdate.emit({
                activeBreakoutRoomsManager: {
                    active: true,
                },
            });
            store.activeBreakoutRoomsManager = {
                active: true,
            };
        };
        this.enableConfirmationModal = (modalType = 'start-breakout') => {
            let activeConfirmationModal = {
                active: true,
                header: 'breakout_rooms.confirm_modal.start_breakout.header',
                content: 'breakout_rooms.confirm_modal.start_breakout.content',
                variant: 'primary',
                cancelText: 'breakout_rooms.confirm_modal.start_breakout.cancelText',
                ctaText: 'breakout_rooms.confirm_modal.start_breakout.ctaText',
                onClick: () => this.applyChanges(),
                onClose: this.handleClose,
            };
            if (modalType === 'close-breakout') {
                activeConfirmationModal = {
                    active: true,
                    header: 'breakout_rooms.confirm_modal.close_breakout.header',
                    content: 'breakout_rooms.confirm_modal.close_breakout.content',
                    variant: 'danger',
                    cancelText: 'cancel',
                    ctaText: 'breakout_rooms.confirm_modal.close_breakout.ctaText',
                    onClick: () => this.closeBreakout(),
                    onClose: this.handleClose,
                };
            }
            this.stateUpdate.emit({
                activeBreakoutRoomsManager: { active: false },
                activeConfirmationModal,
            });
        };
        this.close = () => {
            this.stateManager.discardChanges();
            this.stateUpdate.emit({
                activeBreakoutRoomsManager: {
                    active: false,
                },
            });
        };
        this.applyChanges = async () => {
            this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { applyingChanges: true });
            await this.stateManager.applyChanges(this.meeting);
            this.close();
            this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { applyingChanges: false });
        };
    }
    onSelectedParticipantsChanged(participants) {
        if (participants.length > 0)
            this.assigningParticipants = true;
        else
            this.assigningParticipants = false;
    }
    connectedCallback() {
        this.permissionsUpdateListener();
        this.meeting.connectedMeetings.on('stateUpdate', this.updateLocalState);
        this.meeting.connectedMeetings.on('changingMeeting', this.close);
        this.meeting.self.permissions.on('permissionsUpdate', this.permissionsUpdateListener);
        this.stateManager = new BreakoutRoomsManager();
        this.fetchRoomState();
    }
    disconnectedCallback() {
        this.meeting.connectedMeetings.off('stateUpdate', this.updateLocalState);
        this.meeting.connectedMeetings.off('changingMeeting', this.close);
        this.meeting.self.permissions.off('permissionsUpdate', this.permissionsUpdateListener);
    }
    async fetchRoomState() {
        this.loading = true;
        await this.meeting.connectedMeetings.getConnectedMeetings();
        this.loading = false;
    }
    setEphemeralStatus(text) {
        this.ephemeralStatusText = text;
        setTimeout(() => {
            this.ephemeralStatusText = '';
        }, 3000);
    }
    onCreateRooms() {
        this.selectedParticipants = [];
        this.stateManager.addNewMeetings(this.roomConfig.rooms);
        this.draftState = this.stateManager.currentState;
        // move to next step -> participants-config
        this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { step: 'participants-config' });
    }
    onParticipantDelete(event) {
        const { detail } = event;
        const id = participantIdentifier(detail);
        if (id == null)
            return;
        this.unassignParticipant(id);
    }
    toggleDragMode(e) {
        this.isDragMode = e.detail;
    }
    assignParticipantsRandomly() {
        if (this.stateManager.unassignedParticipants.length === 0)
            return;
        this.stateManager.assignParticipantsRandomly();
        this.draftState = this.stateManager.currentState;
        this.setEphemeralStatus(this.t('breakout_rooms.ephemeral_status.participants_assigned_randomly'));
    }
    async joinRoom(destinationMeetingId) {
        const participantId = participantIdentifier(this.meeting.self);
        this.stateManager.assignParticipantsToMeeting([participantId], destinationMeetingId);
        await this.applyChanges();
    }
    async closeBreakout() {
        this.stateManager.allConnectedMeetings.forEach((meeting) => this.stateManager.deleteMeeting(meeting.id));
        await this.applyChanges();
    }
    updateSelectedParticipants(e) {
        this.selectedParticipants = e.detail;
    }
    updateAllParticipants(e) {
        this.selectedParticipants = e.detail;
    }
    getStatusText() {
        if (this.ephemeralStatusText !== '')
            return this.ephemeralStatusText;
        let statusText = '';
        if (this.roomConfig.mode === 'create') {
            statusText = this.t('breakout_rooms.status.assign_multiple');
            if (this.selectedParticipants.length !== 0) {
                statusText = this.t('breakout_rooms.status.select_room');
            }
        }
        return statusText;
    }
    getApproxDistribution() {
        const num = this.stateManager.unassignedParticipants.length / (this.roomConfig.rooms || MIN_ROOMS);
        return Math.max(MIN_ROOMS, Math.round(num));
    }
    deselectAll() {
        this.selectedParticipants = [];
    }
    async discardChanges() {
        this.stateManager.discardChanges();
        await this.fetchRoomState();
        this.setEphemeralStatus(this.t('breakout_rooms.ephemeral_status.changes_discarded'));
    }
    shouldShowOnlyRoomSwitcher() {
        return this.permissions.canAlterConnectedMeetings === false;
    }
    getPermittedRooms() {
        if (this.permissions.canAlterConnectedMeetings || this.permissions.canSwitchConnectedMeetings) {
            return this.stateManager.allConnectedMeetings;
        }
        return this.stateManager.allConnectedMeetings.filter((cMeeting) => cMeeting.id === this.meeting.meta.meetingId);
    }
    renderMainRoomMaybe() {
        if (!(this.meeting.connectedMeetings.isActive && this.permissions.canSwitchToParentMeeting)) {
            return null;
        }
        return (h("rtk-breakout-room-manager", { key: this.stateManager.currentState.parentMeeting['id'], assigningParticipants: this.assigningParticipants, isDragMode: this.isDragMode, meeting: this.meeting, mode: this.roomConfig.mode, onParticipantsAdd: () => this.assignParticipantsToRoom(this.stateManager.currentState.parentMeeting['id']), onRoomJoin: () => this.joinRoom(this.stateManager.currentState.parentMeeting['id']), onUpdate: this.onRoomUpdate, states: this.states, room: Object.assign({}, this.stateManager.currentState.parentMeeting), iconPack: this.iconPack, t: this.t }));
    }
    renderRoomSwitcher() {
        return (h(Host, null, h("div", { class: "room-switcher-container" }, h("header", null, h("rtk-icon", { icon: this.iconPack.breakout_rooms }), h("span", null, this.t('breakout_rooms.join_breakout_header'))), h("div", { class: "rooms", ref: (el) => (this.selectorRef = el) }, this.renderMainRoomMaybe(), this.getPermittedRooms().map((room, idx) => {
            return (h("rtk-breakout-room-manager", { key: room['id'], assigningParticipants: this.assigningParticipants, isDragMode: this.isDragMode, defaultExpanded: idx === 0, meeting: this.meeting, mode: this.roomConfig.mode, onDelete: () => this.onRoomDelete(room['id']), onParticipantsAdd: () => this.assignParticipantsToRoom(room['id']), onRoomJoin: () => this.joinRoom(room['id']), states: this.states, room: Object.assign({}, room), iconPack: this.iconPack, t: this.t, allowDelete: false }));
        })))));
    }
    renderLoading() {
        return (h(Host, null, h("div", { class: "loading-content" }, h("rtk-spinner", { size: "xl" }))));
    }
    renderRoomConfig() {
        return (h(Host, null, h("div", { class: "room-config" }, h("header", null, h("rtk-icon", { icon: this.iconPack.breakout_rooms }), h("span", null, this.t('breakout_rooms.room_config_header'))), h("div", { class: "create-room" }, h("p", null, this.t('breakout_rooms.num_of_rooms')), h("rtk-counter", { value: this.roomConfig.rooms, minValue: MIN_ROOMS, iconPack: this.iconPack, t: this.t, onValueChange: (val) => {
                this.roomConfig = Object.assign(Object.assign({}, this.roomConfig), { rooms: Math.max(+val.detail, MIN_ROOMS) });
            } })), h("span", { class: "distribution-hint" }, `${this.t('breakout_rooms.approx')}${' '}`, ' ', h("em", null, this.getApproxDistribution(), " ", this.t('breakout_rooms.participants_per_room')), ' ', this.t('breakout_rooms.division_text')), h("footer", null, h("rtk-button", { kind: "button", size: "lg", title: this.t('create'), disabled: this.roomConfig.rooms === 0, onClick: () => this.onCreateRooms() }, this.t('create'))))));
    }
    render() {
        if (this.loading) {
            return this.renderLoading();
        }
        if (this.shouldShowOnlyRoomSwitcher()) {
            return this.renderRoomSwitcher();
        }
        if (this.roomConfig.step === 'room-config') {
            return this.renderRoomConfig();
        }
        // participant config
        return (h(Host, null, h("div", { class: "participant-config-wrapper" }, h("div", { class: "participant-config" }, h("aside", { part: "menu" }, h("header", null, this.t('breakout_rooms.assign_participants')), h("rtk-breakout-room-participants", { meeting: this.meeting, iconPack: this.iconPack, t: this.t, participantIds: this.stateManager.unassignedParticipants.map(participantIdentifier), selectedParticipantIds: this.selectedParticipants }, h("rtk-tooltip", { label: this.t('breakout_rooms.shuffle_participants'), slot: "shuffle-button" }, h("rtk-button", { disabled: this.roomConfig.mode === 'edit' ||
                this.stateManager.unassignedParticipants.length === 0, kind: "button", variant: "secondary", size: "md", onClick: () => this.assignParticipantsRandomly(), class: "shuffle-button br-primary-btn" }, h("rtk-icon", { icon: this.iconPack.shuffle })))), this.selectedParticipants.length !== 0 && (h("div", { class: "participants-assign-actions" }, h("span", null, `${this.selectedParticipants.length} ${this.t('breakout_rooms.selected')}`), h("rtk-button", { disabled: this.roomConfig.mode === 'edit', kind: "button", variant: "ghost", size: "md", onClick: () => this.deselectAll(), class: "deselect-button color-danger" }, this.t('breakout_rooms.deselect'))))), h("div", { class: "assign-rooms" }, h("div", { class: "row" }, h("p", { class: "row-header" }, this.t('breakout_rooms.rooms'), " (", this.stateManager.allConnectedMeetings.length, ")"), !this.assigningParticipants && (h("div", { class: "cta-buttons" }, h("rtk-button", { kind: "button", variant: "secondary", class: "br-primary-btn" }, h("div", { onClick: this.onAddNewRoom }, h("rtk-icon", { icon: this.iconPack.add }), this.t('breakout_rooms.add_room'))), this.stateManager.allConnectedMeetings.flatMap((m) => m.participants)
            .length !== 0 && (h("rtk-button", { kind: "button", variant: "ghost", onClick: this.onUnassignAll }, this.t('breakout_rooms.unassign_all')))))), h("div", { class: "rooms", ref: (el) => (this.selectorRef = el) }, this.renderMainRoomMaybe(), this.getPermittedRooms().map((room, idx) => {
            return (h("rtk-breakout-room-manager", { key: room['id'], assigningParticipants: this.assigningParticipants, isDragMode: this.isDragMode, defaultExpanded: idx === 0, meeting: this.meeting, mode: this.roomConfig.mode, onDelete: () => this.onRoomDelete(room['id']), onParticipantsAdd: () => this.assignParticipantsToRoom(room['id']), onRoomJoin: () => this.joinRoom(room['id']), onUpdate: this.onRoomUpdate, states: this.states, room: Object.assign({}, room), iconPack: this.iconPack, t: this.t, allowDelete: this.stateManager.allConnectedMeetings.length > MIN_ROOMS }));
        }), h("rtk-button", { kind: "button", variant: "secondary", onClick: this.onAddNewRoom, class: "add-room-jumbo-btn br-secondary-btn" }, h("div", null, h("rtk-icon", { icon: this.iconPack.add }), h("span", null, this.t('breakout_rooms.add_room_brief'))))))), h("div", { class: "participant-config-actions" }, h("div", { class: { 'status-bar': true, 'ephemeral-status': this.ephemeralStatusText !== '' } }, this.ephemeralStatusText !== '' && h("rtk-icon", { icon: this.iconPack.checkmark }), this.getStatusText()), h("div", { class: "breakout-actions" }, this.roomConfig.mode === 'create' && this.permissions.canAlterConnectedMeetings && (h("rtk-button", { size: "md", class: "start-breakout-button", onClick: () => this.enableConfirmationModal('start-breakout') }, this.t('breakout_rooms.start_breakout'))), this.roomConfig.mode === 'edit' &&
            this.stateManager.hasLocalChanges &&
            this.permissions.canAlterConnectedMeetings && (h("rtk-button", { size: "md", class: "color-danger", variant: "ghost", onClick: () => this.discardChanges() }, this.t('breakout_rooms.discard_changes'))), this.roomConfig.mode === 'edit' &&
            this.stateManager.hasLocalChanges &&
            this.permissions.canAlterConnectedMeetings && (h("rtk-button", { size: "md", class: "update-breakout-button", onClick: this.applyChanges }, this.t('breakout_rooms.update_breakout'))), this.roomConfig.mode === 'edit' &&
            !this.stateManager.hasLocalChanges &&
            this.permissions.canAlterConnectedMeetings && (h("rtk-button", { size: "md", class: "close-breakout-button", onClick: () => this.enableConfirmationModal('close-breakout') }, this.t('breakout_rooms.close_breakout'))))))));
    }
    static get watchers() { return {
        "selectedParticipants": [{
                "onSelectedParticipantsChanged": 0
            }]
    }; }
};
__decorate$8([
    SyncWithStore()
], RtkBreakoutRoomsManager.prototype, "meeting", void 0);
__decorate$8([
    SyncWithStore()
], RtkBreakoutRoomsManager.prototype, "states", void 0);
__decorate$8([
    SyncWithStore()
], RtkBreakoutRoomsManager.prototype, "iconPack", void 0);
__decorate$8([
    SyncWithStore()
], RtkBreakoutRoomsManager.prototype, "t", void 0);
RtkBreakoutRoomsManager.style = rtkBreakoutRoomsManagerCss();

const rtkBroadcastMessageModalCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--rtk-border-radius-md, 8px);padding:var(--rtk-space-4, 16px);width:100%;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));width:400px;max-width:80%}.content-col{display:flex;width:100%;flex-direction:column}h2{margin:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-2, 8px)}.content-row{display:flex;width:100%;flex-direction:row}.content-row rtk-button{margin-top:var(--rtk-space-4, 16px);width:100%}textarea{margin-top:var(--rtk-space-3, 12px);resize:none;border-radius:var(--rtk-border-radius-sm, 4px);border-width:var(--rtk-border-width-none, 0);border-style:none;font-family:var(--rtk-font-family, sans-serif);outline:2px solid transparent;outline-offset:2px;height:var(--rtk-space-16, 64px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));padding:var(--rtk-space-2, 8px);color:rgb(var(--rtk-colors-text-800, 255 255 255 / 0.76))}textarea::-moz-placeholder{color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}textarea::placeholder{color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}select{border-radius:var(--rtk-border-radius-sm, 4px);border-width:var(--rtk-border-width-none, 0);border-style:none;padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px);outline:2px solid transparent;outline-offset:2px;border-right-width:var(--rtk-border-width-md, 2px);border-style:solid;border-color:transparent;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}p{margin:var(--rtk-space-0, 0px);margin-top:var(--rtk-space-2, 8px);width:100%;text-align:center;font-size:14px;--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-300, 73 124 253) / var(--tw-text-opacity));display:flex;flex-direction:row;align-items:center;justify-content:center}p rtk-icon{margin-left:var(--rtk-space-1, 4px);height:var(--rtk-space-5, 20px)}`;

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
const RtkBroadcastMessageModal = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Broadcast message state */
        this.messagePayload = {
            to: 'Everyone',
            message: '',
        };
        this.successMessage = false;
    }
    close() {
        var _a;
        (_a = this.stateUpdate) === null || _a === void 0 ? void 0 : _a.emit({ activeBroadcastMessageModal: false });
    }
    sendMessage() {
        // TODO:(ishita1805) Send this.messagePayload to webcore.
        this.successMessage = true;
        setTimeout(() => {
            this.close();
        }, 2000);
    }
    render() {
        return (h(Host, { key: '0ddf3933cc56bd2d95a2d112965c22070a52c1ca' }, h("div", { key: '4a1428283dee02f1d09b0650b0facceebd612772', class: "content-col" }, h("h2", { key: '610e4ada5ae3543b629526324e4608e9950a20b0' }, "Broadcast message to"), h("select", { key: '46b4a3573a196f00ad1d9d20d92f3e03b250162c', onChange: (e) => {
                this.messagePayload = Object.assign(Object.assign({}, this.messagePayload), { to: e.target.value });
            } }, h("option", { key: 'aaa981db25435bb257d02086463703d3d2a14ec2' }, "Everyone"), h("option", { key: '4bae49f7600fe5b5156f030e2f2433b334856e00' }, "List of rooms")), h("textarea", { key: '0d6da453ebb0b9711c79ba3c2c2c71a662955a9d', placeholder: "Type message here...", onInput: (e) => {
                this.messagePayload = Object.assign(Object.assign({}, this.messagePayload), { message: e.target.value });
            } }), this.successMessage ? (h("p", null, "Message sent to ", this.messagePayload.to, h("rtk-icon", { icon: this.iconPack.checkmark }))) : (h("div", { class: "content-row" }, h("rtk-button", { onClick: () => this.close(), variant: "secondary" }, "Cancel"), "\u2002", h("rtk-button", { variant: "primary", onClick: () => this.sendMessage() }, "Send"))))));
    }
};
__decorate$7([
    SyncWithStore()
], RtkBroadcastMessageModal.prototype, "meeting", void 0);
__decorate$7([
    SyncWithStore()
], RtkBroadcastMessageModal.prototype, "states", void 0);
__decorate$7([
    SyncWithStore()
], RtkBroadcastMessageModal.prototype, "iconPack", void 0);
__decorate$7([
    SyncWithStore()
], RtkBroadcastMessageModal.prototype, "t", void 0);
RtkBroadcastMessageModal.style = rtkBroadcastMessageModalCss();

const rtkConfirmationModalCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:flex;flex-direction:column;overflow:hidden;border-radius:var(--rtk-border-radius-md, 8px);padding:var(--rtk-space-8, 32px);width:100%;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255));width:400px;max-width:80%}.leave-modal{width:100%;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.leave-modal .header h2{margin:var(--rtk-space-0, 0px)}.leave-modal .content{font-size:14px}.leave-modal p{margin-top:var(--rtk-space-3, 12px);margin-bottom:var(--rtk-space-3, 12px)}.leave-meeting{display:flex;flex-direction:row;justify-content:space-between;gap:var(--rtk-space-4, 16px)}.leave-meeting rtk-button{color:rgb(var(--rtk-colors-text-1000, 255 255 255));flex:1 1 0%}.br-secondary-btn{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.br-secondary-btn:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}`;

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
const RtkConfirmationModal = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.keyPressListener = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.close = () => {
            this.states.activeConfirmationModal.onClose(this.stateUpdate, this.states, this.meeting);
            this.stateUpdate.emit({ activeConfirmationModal: { active: false } });
            this.states.activeConfirmationModal = { active: false };
        };
        this.onConfirmation = async () => {
            this.states.activeConfirmationModal.onClick(this.stateUpdate, this.states, this.meeting);
            this.stateUpdate.emit({ activeConfirmationModal: { active: false } });
            this.states.activeConfirmationModal = { active: false };
        };
    }
    connectedCallback() {
        document.addEventListener('keydown', this.keyPressListener);
    }
    componentDidLoad() { }
    disconnectedCallback() {
        document.removeEventListener('keydown', this.keyPressListener);
    }
    render() {
        var _a, _b;
        const state = this.states.activeConfirmationModal;
        return (h(Host, { key: 'faaa0531618c40c1e31ab3f77a9b038cd917244e' }, h("div", { key: '930c37d5d2e290a739d50dcd9c2ad298465850d3', class: "leave-modal" }, h("div", { key: '0bfb807f0f28d8bc1a28c03c548eca5b0e36eaab', class: "header" }, h("h2", { key: '0985fb052282b0b67ec259bd4e3b555405bc7283', class: "title" }, state.header ? this.t(state.header) : this.t('cta.confirmation'))), state.content && h("p", { key: '99ea852e8d28f4164a6bd159dcb1b967c92b7a63', class: "message" }, this.t(state.content)), h("div", { key: '44073f19fa772c1d4c4bcc4962be90aad26b6965', class: "content" }, h("div", { key: '823c39dfd07659d5f9391242acdac1654e14b588', class: "leave-meeting" }, h("rtk-button", { key: 'e549f53577a5a3b4e677fac6b66f5024868c748f', variant: "secondary", title: state.cancelText ? this.t(state.cancelText) : this.t('cancel'), onClick: this.close, class: "br-secondary-btn" }, state.cancelText ? this.t(state.cancelText) : this.t('cancel')), h("rtk-button", { key: 'da7969392d5781fb63e999c6e4c6b022f7aae23d', onClick: () => this.onConfirmation(), variant: (_b = (_a = this.states.activeConfirmationModal) === null || _a === void 0 ? void 0 : _a.variant) !== null && _b !== void 0 ? _b : 'danger', title: state.ctaText ? this.t(state.ctaText) : this.t('yes') }, state.ctaText ? this.t(state.ctaText) : this.t('yes')))))));
    }
};
__decorate$6([
    SyncWithStore()
], RtkConfirmationModal.prototype, "meeting", void 0);
__decorate$6([
    SyncWithStore()
], RtkConfirmationModal.prototype, "states", void 0);
__decorate$6([
    SyncWithStore()
], RtkConfirmationModal.prototype, "iconPack", void 0);
__decorate$6([
    SyncWithStore()
], RtkConfirmationModal.prototype, "t", void 0);
RtkConfirmationModal.style = rtkConfirmationModalCss();

const rtkDebuggerCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host{position:relative;display:flex;overflow:hidden;border-radius:var(--rtk-border-radius-md, 8px);width:100%;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));color:rgb(var(--rtk-colors-text-1000, 255 255 255))}header{margin-right:var(--rtk-space-2, 8px);display:flex;align-items:center;justify-content:space-between;padding-top:var(--rtk-space-0, 0px);padding-bottom:var(--rtk-space-0, 0px);padding-left:var(--rtk-space-2, 8px);padding-right:var(--rtk-space-2, 8px)}header h3{margin-top:var(--rtk-space-4, 16px);margin-bottom:var(--rtk-space-4, 16px)}.back-btn{border-radius:var(--rtk-border-radius-sm, 4px);background-color:transparent;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow)}.back-btn:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}aside{box-sizing:border-box;display:flex;max-width:var(--rtk-space-56, 224px) !important;flex-direction:column;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));padding-left:var(--rtk-space-2, 8px)}aside button{margin-top:var(--rtk-space-4, 16px);box-sizing:border-box;display:flex;width:100%;align-items:center;justify-content:space-between;border-top-left-radius:var(--rtk-border-radius-sm, 4px);border-bottom-left-radius:var(--rtk-border-radius-sm, 4px);padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px);padding-top:var(--rtk-space-3, 12px);padding-bottom:var(--rtk-space-3, 12px);background-color:transparent;color:rgb(var(--rtk-colors-text-900, 255 255 255 / 0.88));cursor:default;font-size:14px;--tw-shadow:0 0 #0000;--tw-shadow-colored:0 0 #0000;box-shadow:var(--tw-ring-offset-shadow, 0 0 #0000), var(--tw-ring-shadow, 0 0 #0000), var(--tw-shadow);border-width:var(--rtk-border-width-none, 0);border-style:none;outline:2px solid transparent;outline-offset:2px}aside button .right{display:flex;align-items:center}aside button .right rtk-icon{height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px)}aside button .right rtk-icon:last-child{margin-left:var(--rtk-space-4, 16px)}aside button[type='button']{cursor:pointer;transition-property:color, background-color, border-color, text-decoration-color, fill, stroke;transition-timing-function:cubic-bezier(0.4, 0, 0.2, 1);transition-duration:150ms}aside button[type='button']:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}aside button[type='button']{border-right:var(--rtk-border-width-md, 2px) solid transparent}aside button.active{--tw-border-opacity:1;border-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-border-opacity));background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.2)}aside button.active:hover{background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / 0.2)}aside button.hidden{display:none}main{position:relative;box-sizing:border-box;display:flex;height:100%;width:100%;flex-direction:column}:host([size='sm']) aside{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));width:100% !important;max-width:100% !important;padding-left:var(--rtk-space-0, 0px)}:host([size='sm']) aside button{border-radius:var(--rtk-border-radius-none, 0)}:host([size='sm']) aside button.active{border-width:var(--rtk-border-width-none, 0);border-style:none;background-color:transparent}:host([size='sm']) aside button.active:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}:host([size='sm']) aside button.hidden{display:none}:host([size='sm']) aside.hide{display:none}aside button:host([size='sm']) aside.hide{display:none}:host([size='sm']) aside button:host([size='sm']) aside.hide{display:none}:host([size='sm']) main{display:none;height:100%;width:100%;padding:var(--rtk-space-0, 0px)}aside button:host([size='sm']) main{display:none}:host([size='sm']) aside button:host([size='sm']) main{display:none}:host([size='sm']) main.active{display:block}:host([size='sm']) header{margin:var(--rtk-space-0, 0px);justify-content:center}:host([size='sm']) header rtk-button{position:absolute;left:var(--rtk-space-4, 16px)}::-webkit-scrollbar{width:8px}::-webkit-scrollbar-track{border-radius:var(--rtk-border-radius-lg, 12px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}::-webkit-scrollbar-thumb{border-radius:var(--rtk-border-radius-lg, 12px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}::-webkit-scrollbar-thumb:hover{border-radius:var(--rtk-border-radius-lg, 12px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}.progress-bar{height:var(--rtk-space-1, 4px);width:100%;overflow:hidden;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.progress-indicator{height:100%;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-brand-500, 33 96 253) / var(--tw-bg-opacity))}`;

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
const RtkDebugger = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.keyPressListener = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.activeTab = 'audio';
        this.isMobileMainVisible = false;
        this.progress = 0;
    }
    connectedCallback() {
        document.addEventListener('keydown', this.keyPressListener);
    }
    disconnectedCallback() {
        this.keyPressListener && document.removeEventListener('keydown', this.keyPressListener);
    }
    progressUpdate(event) {
        this.progress = event.detail;
    }
    changeTab(tab) {
        this.activeTab = tab;
        if (this.size === 'sm') {
            if (!this.isMobileMainVisible) {
                this.isMobileMainVisible = true;
            }
        }
    }
    close() {
        this.stateUpdate.emit({ activeDebugger: false });
    }
    getActiveTab() {
        switch (this.activeTab) {
            case 'audio':
                return this.t('debugger.audio.troubleshooting.label');
            case 'screenshare':
                return this.t('debugger.screenshare.troubleshooting.label');
            case 'video':
                return this.t('debugger.video.troubleshooting.label');
            case 'system':
                return this.t('debugger.system.troubleshooting.label');
            default:
                return this.t('debugger.troubleshooting.label');
        }
    }
    render() {
        if (!this.meeting)
            return null;
        const defaults = {
            meeting: this.meeting,
            states: this.states,
            iconPack: this.iconPack,
            t: this.t,
            size: this.size,
        };
        const tab = this.getActiveTab();
        const showSystemsTab = typeof navigator.getBattery !== 'undefined';
        return (h(Host, null, h("aside", { class: { hide: this.isMobileMainVisible }, part: "menu" }, h("header", null, h("h3", null, this.t('debugger.troubleshooting.label'))), h("button", { type: "button", class: { active: this.activeTab === 'audio' }, onClick: () => this.changeTab('audio') }, this.t('debugger.audio.label'), h("div", { class: "right" }, h("rtk-icon", { icon: this.iconPack.mic_on }), this.size === 'sm' && h("rtk-icon", { icon: this.iconPack.chevron_right }))), h("button", { type: "button", class: { active: this.activeTab === 'video' }, onClick: () => this.changeTab('video') }, this.t('debugger.video.label'), h("div", { class: "right" }, h("rtk-icon", { icon: this.iconPack.video_on }), this.size === 'sm' && h("rtk-icon", { icon: this.iconPack.chevron_right }))), h("button", { type: "button", class: { active: this.activeTab === 'screenshare' }, onClick: () => this.changeTab('screenshare') }, this.t('debugger.screenshare.label'), h("div", { class: "right" }, h("rtk-icon", { icon: this.iconPack.share_screen_start }), this.size === 'sm' && h("rtk-icon", { icon: this.iconPack.chevron_right }))), h("button", { type: "button", class: { active: this.activeTab === 'system', hidden: !showSystemsTab }, onClick: () => this.changeTab('system') }, this.t('debugger.system.label'), h("div", { class: "right" }, h("rtk-icon", { icon: this.iconPack.settings }), this.size === 'sm' && h("rtk-icon", { icon: this.iconPack.chevron_right })))), h("main", { class: { active: this.isMobileMainVisible }, part: "main-content" }, this.size === 'sm' && (h("header", null, h("rtk-button", { kind: "icon", class: "back-btn", onClick: () => (this.isMobileMainVisible = false) }, h("rtk-icon", { icon: this.iconPack.chevron_left })), h("h4", null, tab))), this.activeTab === 'audio' && h("rtk-debugger-audio", Object.assign({}, defaults)), this.activeTab === 'video' && h("rtk-debugger-video", Object.assign({}, defaults)), this.activeTab === 'screenshare' && (h("rtk-debugger-screenshare", Object.assign({}, defaults))), this.activeTab === 'system' && showSystemsTab && (h("rtk-debugger-system", Object.assign({}, defaults))))));
    }
};
__decorate$5([
    SyncWithStore()
], RtkDebugger.prototype, "meeting", void 0);
__decorate$5([
    SyncWithStore()
], RtkDebugger.prototype, "states", void 0);
__decorate$5([
    SyncWithStore()
], RtkDebugger.prototype, "iconPack", void 0);
__decorate$5([
    SyncWithStore()
], RtkDebugger.prototype, "t", void 0);
RtkDebugger.style = rtkDebuggerCss();

const rtkJoinStageCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.scrollbar{scrollbar-width:thin;scrollbar-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))     var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar{height:var(--rtk-space-1\\.5, 6px);width:var(--rtk-space-1\\.5, 6px);border-radius:9999px;background-color:var(--rtk-scrollbar-background, transparent)}.scrollbar::-webkit-scrollbar-thumb{border-radius:9999px;background-color:var(--rtk-scrollbar-color, rgb(var(--rtk-colors-background-600, 60 60 60)))}:host::-webkit-scrollbar{width:var(--rtk-space-1\\.5, 6px);border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity))}:host::-webkit-scrollbar-thumb{border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}:host(.stage){box-sizing:border-box;display:block;width:512px;--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity));padding:var(--rtk-space-6, 24px);-webkit-user-select:none;-moz-user-select:none;user-select:none;overflow:auto;border-radius:var(--rtk-border-radius-md, 8px);line-height:1.25}:host(.stage) rtk-participant-setup{display:flex;flex:1 1 0%;align-items:center;justify-content:space-around;margin-left:auto;margin-right:auto}:host(.stage) .container rtk-button{flex-grow:1;padding:var(--rtk-space-1, 4px);width:50%}:host(.stage) .container rtk-button:nth-child(1){margin-right:var(--rtk-space-1\\.5, 6px)}:host(.stage) .container rtk-button:nth-child(2){margin-left:var(--rtk-space-1\\.5, 6px)}:host(.stage) h2{font-size:24px;font-weight:500;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}:host(.stage) header{padding-left:var(--rtk-space-4, 16px);padding-right:var(--rtk-space-4, 16px)}:host(.stage) .summary{padding:var(--rtk-space-4, 16px)}.deny-access{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-700, 44 44 44) / var(--tw-bg-opacity))}.container{width:100%;max-width:1080px;display:flex;flex:1 1 0%;align-items:center;justify-content:space-around}header{display:flex;align-items:center;justify-content:space-between}`;

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
const RtkJoinStage = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.joinStage = createEvent(this, "rtkJoinStage", 7);
        this.leaveStage = createEvent(this, "rtkLeaveStage", 7);
        /** UI Config */
        this.config = createDefaultConfig();
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Content Config */
        this.dataConfig = {
            title: this.t('stage.join_title'),
            label: {
                accept: this.t('stage.join_confirm'),
                reject: this.t('stage.join_cancel'),
            },
            description: this.t('stage.join_summary'),
        };
        this.isLoading = false;
    }
    render() {
        var _a, _b;
        const defaults = {
            meeting: this.meeting,
            size: this.size,
            states: this.states,
            config: this.config,
            iconPack: this.iconPack,
            t: this.t,
        };
        return (h(Host, { key: '2000c74c7b15b8ad8cc8d7b2940ee1c47c504111', class: { stage: true } }, h("header", { key: '1be2b7c17338f42472bd47c761e8a972d960eb45' }, h("h2", { key: '8a2d2e49eb154fc58f121f26c067519473007aa1' }, this.dataConfig.title)), h(Render, { key: '17476c475c67d3eedfce7e66a2dc1829211e6f7b', element: "rtk-participant-setup", defaults: defaults, props: { participant: (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self, size: 'md' }, childProps: { participant: (_b = this.meeting) === null || _b === void 0 ? void 0 : _b.self, size: 'md' }, deepProps: true }), h("div", { key: '708a514d2f5c903c5e01161a374455134f9c5fde', class: "summary" }, this.dataConfig.description), h("div", { key: '690c062b55469b6d2757628cf9c841db05cb50dd', class: "container" }, h("rtk-button", { key: '3c840601730f7c31da94f58fcc7a36fa7f2e98ac', variant: "secondary", onClick: () => this.leaveStage.emit(), title: this.dataConfig.label.reject }, this.dataConfig.label.reject), h("rtk-button", { key: 'd4838af3f9b36c6d91ce04d9862840ee838111de', onClick: () => {
                if (this.isLoading)
                    return;
                this.isLoading = true;
                this.joinStage.emit();
            }, title: this.dataConfig.label.accept }, this.isLoading ? (h("rtk-icon", { icon: this.iconPack.spinner })) : (this.dataConfig.label.accept)))));
    }
};
__decorate$4([
    SyncWithStore()
], RtkJoinStage.prototype, "meeting", void 0);
__decorate$4([
    SyncWithStore()
], RtkJoinStage.prototype, "config", void 0);
__decorate$4([
    SyncWithStore()
], RtkJoinStage.prototype, "states", void 0);
__decorate$4([
    SyncWithStore()
], RtkJoinStage.prototype, "iconPack", void 0);
__decorate$4([
    SyncWithStore()
], RtkJoinStage.prototype, "t", void 0);
RtkJoinStage.style = rtkJoinStageCss();

const rtkLeaveMeetingCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}.leave-modal{width:var(--rtk-space-72, 288px)}@media (min-width: 768px){.leave-modal{width:var(--rtk-space-96, 384px)}}.leave-modal{position:relative;display:flex;flex-direction:column;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));padding:var(--rtk-space-8, 32px);color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.leave-modal .header h2{margin:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-3, 12px)}.leave-modal .message{color:rgb(var(--rtk-colors-text-600, 255 255 255 / 0.52))}.leave-modal .content{margin-top:var(--rtk-space-4, 16px);font-size:14px;display:flex;flex-wrap:wrap;gap:var(--rtk-space-4, 16px)}.leave-modal .content rtk-button{height:var(--rtk-space-9, 36px);min-width:var(--rtk-space-44, 176px);flex-grow:1}.leave-modal .content .secondary-btn{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-800, 30 30 30) / var(--tw-bg-opacity))}.leave-modal .content .secondary-btn:hover{--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-600, 60 60 60) / var(--tw-bg-opacity))}.leave-modal .content .secondary-danger-btn{--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}`;

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
const RtkLeaveMeeting = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        this.keyPressListener = (e) => {
            if (e.key === 'Escape') {
                this.close();
            }
        };
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.canEndMeeting = false;
        this.isBreakoutRoomsActive = false;
        this.isChildMeeting = false;
        this.canJoinMainRoom = false;
        this.permissionsUpdateListener = () => {
            this.canEndMeeting = this.meeting.self.permissions.kickParticipant;
            this.canJoinMainRoom = this.meeting.self.permissions.connectedMeetings.canSwitchToParentMeeting;
        };
        this.close = () => {
            this.stateUpdate.emit({ activeLeaveConfirmation: false });
        };
        this.handleLeave = () => {
            var _a;
            (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.leave();
            this.close();
        };
        this.handleJoinMainRoom = () => {
            this.meeting.connectedMeetings.moveParticipants(this.meeting.meta.meetingId, this.meeting.connectedMeetings.parentMeeting.id, [this.meeting.self.userId]);
            this.close();
        };
        this.handleEndMeeting = () => {
            var _a;
            (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.participants.kickAll();
            this.close();
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
        document.addEventListener('keydown', this.keyPressListener);
    }
    disconnectedCallback() {
        var _a;
        document.removeEventListener('keydown', this.keyPressListener);
        (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.permissions.removeListener('permissionsUpdate', this.permissionsUpdateListener);
    }
    meetingChanged(meeting) {
        if (meeting != null) {
            this.isBreakoutRoomsActive = this.meeting.connectedMeetings.isActive;
            this.isChildMeeting = this.meeting.connectedMeetings.meetings.some((cMeet) => cMeet.id === meeting.meta.meetingId);
            this.meeting.self.permissions.addListener('permissionsUpdate', this.permissionsUpdateListener);
            this.permissionsUpdateListener();
        }
    }
    render() {
        return (h(Host, { key: '93a88022c62d7e1dbcd512fa19ad72e7e938e6cc' }, h("div", { key: '526c2dc395fe41a2e980c881c0d3d145c86e7c76', class: "leave-modal" }, h("div", { key: 'ecd34ea2ecc74099a9377ced64a24667aa2e24aa', class: "header" }, h("h2", { key: '51c05788210388df22e871bad265c05c40b7dd75', class: "title" }, this.t('leave'))), h("p", { key: 'fd6a2f2cc6f75c808f995bff3bf5e8628806a0b1', class: "message" }, this.isBreakoutRoomsActive && this.isChildMeeting
            ? this.t('breakout_rooms.leave_confirmation')
            : this.t('leave_confirmation')), h("div", { key: '6ed0ae860e10f08858707aea9eae9530cfb0eb88', class: "content" }, h("rtk-button", { key: '8ecc5aca329f6bb5eac183dc5e997834c9b511ae', variant: "secondary", onClick: this.close, class: "secondary-btn" }, this.t('cancel')), this.isBreakoutRoomsActive && this.isChildMeeting && this.canJoinMainRoom && (h("rtk-button", { key: '8a31fdea844a2ce4b3b4aeba4114ef0178e2df0b', variant: "secondary", onClick: this.handleJoinMainRoom, class: "secondary-btn" }, this.t('breakout_rooms.leave_confirmation.main_room_btn'))), h("rtk-button", { key: 'e8d815dccf9ea30ab9290f4789f855412b2c9baa', variant: "danger", title: this.t('leave'), onClick: this.handleLeave }, this.t('leave')), this.canEndMeeting && (h("rtk-button", { key: '64073a99ca9ee3beee04ce0aaa4ec4346d5c4de1', variant: "danger", class: "secondary-btn secondary-danger-btn", onClick: this.handleEndMeeting }, this.t('end.all')))))));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate$3([
    SyncWithStore()
], RtkLeaveMeeting.prototype, "meeting", void 0);
__decorate$3([
    SyncWithStore()
], RtkLeaveMeeting.prototype, "states", void 0);
__decorate$3([
    SyncWithStore()
], RtkLeaveMeeting.prototype, "iconPack", void 0);
__decorate$3([
    SyncWithStore()
], RtkLeaveMeeting.prototype, "t", void 0);
RtkLeaveMeeting.style = rtkLeaveMeetingCss();

const rtkMuteAllConfirmationCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:block;-webkit-user-select:none;-moz-user-select:none;user-select:none}.leave-modal{position:relative;display:flex;flex-direction:column;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-900, 26 26 26) / var(--tw-bg-opacity));padding:var(--rtk-space-4, 16px);color:rgb(var(--rtk-colors-text-1000, 255 255 255))}.leave-modal .header h2{margin:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-3, 12px)}.leave-modal .content{font-size:14px}.leave-message p{margin-top:var(--rtk-space-3, 12px);margin-bottom:var(--rtk-space-3, 12px)}.leave-meeting{display:flex;flex-direction:row;justify-content:space-between;gap:var(--rtk-space-2, 8px)}.leave-meeting rtk-button{flex:1 1 0%}.end-meeting{margin-top:var(--rtk-space-2, 8px)}.message{margin-bottom:var(--rtk-space-4, 16px)}label{display:flex;align-items:center}input[type='checkbox']{margin-right:var(--rtk-space-2, 8px);accent-color:rgb(var(--rtk-colors-brand-500, 33 96 253))}`;

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
const RtkMuteAllConfirmation = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        this.allowUnmute = true;
        this.onClose = () => {
            this.stateUpdate.emit({ activeMuteAllConfirmation: false });
        };
        this.onMuteAll = () => {
            var _a;
            (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.participants.disableAllAudio(this.allowUnmute);
            this.onClose();
        };
    }
    render() {
        return (h(Host, { key: 'e47a9e4e3c89bc1badc85cb76edf522eb8514c58' }, h("div", { key: 'bafee985eb5f1e01d87e509018917473d3723190', class: "leave-modal" }, h("div", { key: 'f21285fa0b0239c9f64a9390599528dfe50a355b', class: "header" }, h("h2", { key: '5201c1d79f1d64e513ef8036b16fd03e27280baf', class: "title" }, this.t('mute_all.header'))), h("p", { key: '5c5af2814146578f3b3c3ae434f45da414b97f15', class: "message" }, this.t('mute_all.description')), h("div", { key: 'cde4bbb5ee289ad5b65a9fb13d0fb5bc5f309a0b', class: "content" }, h("div", { key: '1f034975b9099d8474c3442da08fc79660b74a70', class: "leave-meeting" }, h("rtk-button", { key: '16614bc8443e1e249d0eda46d66227eedf036856', variant: "secondary", title: this.t('close'), onClick: this.onClose }, this.t('cancel')), h("rtk-button", { key: '6f67cf660adcc1d849f5cd090003a5c7ad26947d', variant: "danger", title: this.t('mute_all'), onClick: this.onMuteAll }, this.t('mute_all')))))));
    }
};
__decorate$2([
    SyncWithStore()
], RtkMuteAllConfirmation.prototype, "meeting", void 0);
__decorate$2([
    SyncWithStore()
], RtkMuteAllConfirmation.prototype, "states", void 0);
__decorate$2([
    SyncWithStore()
], RtkMuteAllConfirmation.prototype, "iconPack", void 0);
__decorate$2([
    SyncWithStore()
], RtkMuteAllConfirmation.prototype, "t", void 0);
RtkMuteAllConfirmation.style = rtkMuteAllConfirmationCss();

const rtkOverlayModalCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{display:flex;height:100%;width:100%;flex-direction:column;align-items:center;justify-content:center;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / 0.6);position:fixed;top:var(--rtk-space-0, 0px);right:var(--rtk-space-0, 0px);z-index:50}rtk-icon{height:var(--rtk-space-20, 80px)}h2{margin:var(--rtk-space-2, 8px);font-weight:500}p{margin:var(--rtk-space-0, 0px);font-size:16px}`;

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
const RtkOverlayModal = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
    }
    connectedCallback() {
        if (this.states.activeOverlayModal.timeout) {
            setTimeout(() => {
                this.stateUpdate.emit({ activeOverlayModal: { active: false } });
            }, this.states.activeOverlayModal.timeout);
        }
    }
    render() {
        return (h(Host, { key: '1c15f5569d6914a3cbbd9685c354f9c14e38d7af' }, h("rtk-icon", { key: 'b3a08daa8c951ca46a8b98c64fca1d178f56ac72', icon: this.states.activeOverlayModal.icon }), h("h2", { key: 'e8498afe9cf9434aaf8e4f1157c174b3268dbd41' }, this.states.activeOverlayModal.title), h("p", { key: 'a48d9a3ed6634682e1f2fc7af69e357d57cb9aaf' }, this.states.activeOverlayModal.description)));
    }
};
__decorate$1([
    SyncWithStore()
], RtkOverlayModal.prototype, "meeting", void 0);
__decorate$1([
    SyncWithStore()
], RtkOverlayModal.prototype, "states", void 0);
__decorate$1([
    SyncWithStore()
], RtkOverlayModal.prototype, "iconPack", void 0);
__decorate$1([
    SyncWithStore()
], RtkOverlayModal.prototype, "t", void 0);
RtkOverlayModal.style = rtkOverlayModalCss();

const rtkPermissionsMessageCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{box-sizing:border-box;display:block;max-height:100%;width:600px;overflow-y:auto;padding:var(--rtk-space-6, 24px);border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgba(var(--rtk-colors-background-1000, 8 8 8) / var(--tw-bg-opacity));overflow-wrap:break-word;color:rgb(var(--rtk-colors-text-1000, 255 255 255));word-wrap:break-word}.actions{display:flex;align-items:center;gap:var(--rtk-space-2, 8px)}.text-icon{display:inline-block;vertical-align:middle}h2{margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-4, 16px)}h2 .text-icon{margin-right:var(--rtk-space-2, 8px);height:var(--rtk-space-8, 32px);width:var(--rtk-space-8, 32px);--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}p{margin-top:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-0, 0px);margin-bottom:var(--rtk-space-4, 16px)}.need-help-link{margin-top:var(--rtk-space-2, 8px);display:inline-block;text-underline-offset:2px;--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-400, 53 110 253) / var(--tw-text-opacity))}.need-help-link:hover{--tw-text-opacity:1;color:rgba(var(--rtk-colors-brand-600, 13 81 253) / var(--tw-text-opacity))}a rtk-icon{margin-right:var(--rtk-space-2, 8px);height:var(--rtk-space-5, 20px);width:var(--rtk-space-5, 20px)}:host([size='sm']) .actions{flex-direction:column;align-items:flex-start;justify-content:center}:host([size='sm']) .action{width:100%;padding-top:var(--rtk-space-2, 8px);padding-bottom:var(--rtk-space-2, 8px)}.actions{margin-top:var(--rtk-space-6, 24px)}.actions rtk-button{flex:1 1 0%}.svg-container{display:flex;width:100%;justify-content:center !important}.svg-ins{width:80%;border-radius:var(--rtk-border-radius-md, 8px);--tw-bg-opacity:1;background-color:rgb(255 255 255 / var(--tw-bg-opacity))}`;

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
const steps = {
    'Chrome.Desktop.audio': ['Chrome1.svg', 'Chrome2.svg', 'Chrome3.svg'],
    'Chrome.Desktop.video': ['Chrome1.svg', 'Chrome2.svg', 'Chrome3.svg'],
};
const RtkPermissionsMessage = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.stateUpdate = createEvent(this, "rtkStateUpdate", 7);
        /** Language */
        this.t = useLanguage();
        /** Icon Pack */
        this.iconPack = defaultIconPack;
        this.currentStep = 0;
        this.svgSteps = [];
        this.continue = () => {
            this.stateUpdate.emit({
                activePermissionsMessage: { enabled: false },
            });
        };
        this.reload = () => {
            if (typeof window !== 'undefined') {
                window.location.reload();
            }
        };
        this.getImage = async (stepURL) => {
            function replaceAll(target, search, replacement) {
                return target.split(search).join(replacement);
            }
            const svgReq = await fetch(`https://rtk-assets.realtime.cloudflare.com/ui-kit/permissions/${stepURL}`);
            let svg = await svgReq.text();
            svg = replaceAll(svg, 'yoursite.com', location.host);
            svg = replaceAll(svg, 'Yoursite', document.title.length > 14 ? `${document.title.slice(0, 14)}...` : document.title);
            return svg;
        };
        this.nextStep = () => {
            this.currentStep = (this.currentStep + 1) % this.svgSteps.length;
        };
        this.openMacSystemSettings = () => {
            const l = document.createElement('a');
            switch (this.mediaType) {
                case 'audio':
                    l.href = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone';
                    break;
                case 'screenshare':
                    l.href = 'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture';
                    break;
                case 'video':
                    l.href = 'x-apple.systempreferences:com.apple.preference.security?Privacy_Camera';
                    break;
            }
            l.click();
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
    }
    disconnectedCallback() {
        if (this.stepsTimer)
            clearTimeout(this.stepsTimer);
    }
    meetingChanged(meeting) {
        var _a, _b, _c;
        if (meeting != null) {
            this.device = meeting.self.device;
            const deviceType = ((_a = this.device) === null || _a === void 0 ? void 0 : _a.isMobile) ? 'Mobile' : 'Desktop';
            const currentSteps = (_c = steps[`${(_b = this.device) === null || _b === void 0 ? void 0 : _b.browserName}.${deviceType}.${this.mediaType}`]) !== null && _c !== void 0 ? _c : [];
            Promise.all(currentSteps.map(this.getImage)).then((currentImages) => {
                this.svgSteps = currentImages;
            });
        }
    }
    getLink(media) {
        let kind;
        switch (media) {
            case 'audio':
                kind = 'microphone';
                break;
            case 'video':
                kind = 'camera';
                break;
            default:
                kind = 'screenshare';
                break;
        }
        const GOOGLE_SEARCH_BASE = 'https://www.google.com/search?q=';
        let query = `Allow+${kind}+access`;
        if (this.device != null) {
            const { browserName, isMobile } = this.device;
            query += '+' + browserName;
            if (isMobile) {
                query += '+mobile';
            }
        }
        return GOOGLE_SEARCH_BASE + query;
    }
    isDeniedBySystem() {
        var _a;
        const permissionsMessage = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.mediaPermissions;
        if (permissionsMessage == null)
            return false;
        if (permissionsMessage[this.mediaType] === 'SYSTEM_DENIED') {
            return true;
        }
        return false;
    }
    getTitle() {
        const isDeniedBySystem = this.isDeniedBySystem();
        if (isDeniedBySystem) {
            return this.t(`perm_sys_denied.${this.mediaType}`);
        }
        return this.t(`perm_denied.${this.mediaType}`);
    }
    get mediaType() {
        var _a, _b, _c;
        return (_c = (_b = (_a = this.states) === null || _a === void 0 ? void 0 : _a.activePermissionsMessage) === null || _b === void 0 ? void 0 : _b.kind) !== null && _c !== void 0 ? _c : 'audio';
    }
    getMessage() {
        var _a;
        const { browserName, osName } = this.meeting.self.device;
        const isDeniedBySystem = this.isDeniedBySystem();
        const browser = (_a = browserName.toLowerCase()) !== null && _a !== void 0 ? _a : 'others';
        const os = osName !== null && osName !== void 0 ? osName : 'others';
        /* NOTE(ravindra-cloudflare):
          If in case a unknown browser or os doesn't have a translation,
          use the translation for `others`, instead of showing ugly error string,
          such as `perm_denied.video.yandex browser.message`.
        */
        if (isDeniedBySystem) {
            const systemErrorKey = `perm_sys_denied.${this.mediaType}.${os.toLowerCase()}.message`;
            return this.t(systemErrorKey) === systemErrorKey
                ? this.t(`perm_sys_denied.${this.mediaType}.others.message`)
                : this.t(systemErrorKey);
        }
        const browserErrorKey = `perm_denied.${this.mediaType}.${browser}.message`;
        return this.t(browserErrorKey) === browserErrorKey
            ? this.t(`perm_denied.${this.mediaType}.others.message`)
            : this.t(browserErrorKey);
    }
    render() {
        var _a, _b, _c;
        const isDeniedBySystem = this.isDeniedBySystem();
        if (this.svgSteps.length > 0) {
            if (this.stepsTimer)
                clearTimeout(this.stepsTimer);
            this.stepsTimer = setTimeout(this.nextStep, 2500);
        }
        const showMacDeepLink = isDeniedBySystem && this.meeting.self.device.osName == 'macOS';
        return (h(Host, { key: '7e7ee4ed331dc9e736b710ce0e492d0d9a749c1b' }, h("h2", { key: '1100ed23a733006ee6b644cbd7293f3e8b187e1b' }, h("rtk-icon", { key: '23d61902856332821e9b9cf60c126fc4e82f2421', class: "text-icon", icon: this.iconPack.warning }), this.getTitle()), this.svgSteps.length > 0 && (h("div", { key: 'c39e69a21e4d5d009397cbe0563c89d2f00bf414', class: 'svg-container' }, this.svgSteps.map((e, index) => (h("p", { innerHTML: e, class: "svg-ins", key: this.currentStep, hidden: index !== this.currentStep }))))), h("div", { key: '209bdbc52a9a26b9b71328a57e79d424302bc8ea' }, this.getMessage()), !isDeniedBySystem && (h("a", { key: 'a096c4b00a29239970f8cd23c123a3d94f78b78f', class: "need-help-link", href: this.getLink((_c = (_b = (_a = this.states) === null || _a === void 0 ? void 0 : _a.activePermissionsMessage) === null || _b === void 0 ? void 0 : _b.kind) !== null && _c !== void 0 ? _c : 'audio'), target: "_blank", rel: "noreferrer external noreferrer noopener" }, h("rtk-icon", { key: '3a0e5cdf4f040381e417a0cf46783ebb47f88f8d', class: "text-icon", icon: this.iconPack.attach }), this.t('cta.help'))), h("div", { key: '31fa2a14b1d134f2bab798852b0a339cbd5e53c4', class: "actions" }, h("rtk-button", { key: '0574447e6f141a5d899d145f6741500304f16e70', size: "lg", kind: "wide", variant: "secondary", onClick: this.continue }, this.t('cta.continue')), showMacDeepLink ? (h("rtk-button", { size: "lg", kind: "wide", onClick: this.openMacSystemSettings }, this.t('cta.system_settings'))) : (h("rtk-button", { size: "lg", kind: "wide", onClick: this.reload }, this.t('cta.reload')))), h("slot", { key: 'bab0db24f078ff258a8223a9910e089c2e2229e1' })));
    }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkPermissionsMessage.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkPermissionsMessage.prototype, "t", void 0);
__decorate([
    SyncWithStore()
], RtkPermissionsMessage.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkPermissionsMessage.prototype, "states", void 0);
RtkPermissionsMessage.style = rtkPermissionsMessageCss();

export { RtkBreakoutRoomsManager as rtk_breakout_rooms_manager, RtkBroadcastMessageModal as rtk_broadcast_message_modal, RtkConfirmationModal as rtk_confirmation_modal, RtkDebugger as rtk_debugger, RtkJoinStage as rtk_join_stage, RtkLeaveMeeting as rtk_leave_meeting, RtkMuteAllConfirmation as rtk_mute_all_confirmation, RtkOverlayModal as rtk_overlay_modal, RtkPermissionsMessage as rtk_permissions_message };

import { r as registerInstance, d as createEvent, h, a as Host, g as getElement } from './index-gJCRRBX0.js';
import { e as defaultIconPack, i as useLanguage, c as createDefaultConfig } from './ui-store-CkvSNsmd.js';
import { l as lenChildren, R as Render } from './index-BUsisVB6.js';
import { f as formatName, a as shorten } from './string-vBD2htwQ.js';
import './breakout-rooms-manager-B1Qky9zO.js';
import './livestream-C0vp-Q7v.js';
import { c as computePosition, b as autoPlacement, o as offset, s as shift, h as hide } from './floating-ui.dom-B1SWgSTZ.js';
import { S as SyncWithStore } from './index-BnFmFXDx.js';
import { d as debounce } from './debounce-BmgYF10w.js';
import './breakout-rooms-Daj_55_i.js';

const rtkParticipantCss = () => `:host{line-height:initial;font-family:var(--rtk-font-family, sans-serif);font-feature-settings:normal;font-variation-settings:normal}p{margin:var(--rtk-space-0, 0px);padding:var(--rtk-space-0, 0px)}:host{position:relative;display:flex;height:var(--rtk-space-14, 56px);align-items:center;justify-content:space-between;cursor:pointer;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}:host rtk-avatar{height:var(--rtk-space-8, 32px);width:var(--rtk-space-8, 32px);font-size:14px}.left{display:flex;align-items:center}.left>*{margin-right:var(--rtk-space-2, 8px)}.left>*:last-child{margin-right:var(--rtk-space-0, 0px)}.right{display:flex;align-items:center;justify-content:flex-end}.right>*{margin-left:var(--rtk-space-2, 8px)}.right>*:first-child{margin-left:var(--rtk-space-0, 0px)}.name{overflow:hidden;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:1}rtk-icon{height:var(--rtk-space-6, 24px);width:var(--rtk-space-6, 24px)}rtk-icon.red{--tw-text-opacity:1;color:rgba(var(--rtk-colors-danger, 255 45 45) / var(--tw-text-opacity))}rtk-icon.more{cursor:pointer}.menu{position:relative;display:inline-block;color:rgb(var(--rtk-colors-text-1000, 255 255 255))}#menu-list{position:absolute;z-index:20}`;

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
const RtkParticipant = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        this.rtkSendNotification = createEvent(this, "rtkSendNotification", 7);
        this.pinnedListener = ({ isPinned }) => {
            this.isPinned = isPinned;
        };
        this.toggleTileListener = ({ hidden }) => {
            this.isHidden = hidden;
        };
        this.stageListener = ({ stageStatus }) => {
            this.isOnStage = stageStatus === 'ON_STAGE';
        };
        /** Show participant summary */
        this.view = 'sidebar';
        /** Icon pack */
        this.iconPack = defaultIconPack;
        /** Language */
        this.t = useLanguage();
        /** Config object */
        this.config = createDefaultConfig();
        this.audioEnabled = false;
        this.videoEnabled = false;
        this.isPinned = false;
        this.isHidden = false;
        this.isOnStage = false;
        this.canDisableParticipantAudio = false;
        this.canDisableParticipantVideo = false;
        this.canKickParticipant = false;
        this.canPinParticipant = false;
        this.canAllowParticipantOnStage = false;
        this.menuOpen = false;
        this.permissionsUpdateListener = () => {
            this.meetingChanged(this.meeting);
        };
        this.inviteToStageToggle = async () => {
            const p = this.participant;
            const { stage } = this.meeting;
            // If request has been sent once, do nothing.
            if (p.stageStatus === 'ACCEPTED_TO_JOIN_STAGE') {
                // Send a notification to host telling that the user has been invited.
                this.rtkSendNotification.emit({
                    message: `${p.name} ${this.t('stage.invited_notification')}`,
                    trace: `join-stage-${p.id}`,
                });
                return;
            }
            if (this.isOnStage) {
                // NOTE (@madhugb): when a pinned participnat is removed from stage, we need to unpin them manually
                if (p.isPinned)
                    p.unpin();
                await stage.kick([p.userId]);
            }
            else {
                await stage.grantAccess([p.userId]);
                // Send a notification to host telling that the user has been invited.
                this.rtkSendNotification.emit({
                    message: `${p.name} ${this.t('stage.invited_notification')}`,
                    trace: `join-stage-invite-${p.id}`,
                });
            }
            this.isOnStage = p.stageStatus === 'ON_STAGE';
        };
        this.handleOutsideClick = (event) => {
            const path = event.composedPath();
            const clickedOutside = !path.includes(this.host);
            // handles clicking on other menu triggers
            if (clickedOutside && this.menuOpen) {
                this.menuOpen = false;
            }
        };
        this.update = () => {
            const triggerEl = this.host.shadowRoot.getElementById('trigger');
            const menuListEl = this.host.shadowRoot.getElementById('menu-list');
            computePosition(triggerEl, menuListEl, {
                placement: 'bottom-end', // Default placement
                middleware: [
                    autoPlacement({
                        allowedPlacements: ['bottom-end', 'top-end'], // Prioritize bottom alignment
                        alignment: 'end', // Align to start of the trigger
                    }),
                    offset(4), // Add space between the trigger and menu
                    shift({ padding: 8 }), // Adjust if the menu is too close to the viewport edges
                    hide(),
                ],
            }).then(({ x, y, placement }) => {
                let position = null;
                if (placement === 'bottom-end') {
                    position = {
                        right: `${x}px`,
                        top: `${y}px`,
                    };
                }
                else {
                    position = {
                        right: `${x}px`,
                        bottom: `${y}px`,
                    };
                }
                Object.assign(menuListEl.style, position);
            });
        };
        this.onMenuToggle = () => {
            this.menuOpen = !this.menuOpen;
            if (this.menuOpen) {
                this.update();
            }
        };
    }
    connectedCallback() {
        this.meetingChanged(this.meeting);
        this.participantChanged(this.participant);
        document.addEventListener('click', this.handleOutsideClick);
    }
    disconnectedCallback() {
        var _a;
        document.removeEventListener('click', this.handleOutsideClick);
        (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.self.permissions.removeListener('permissionsUpdate', this.permissionsUpdateListener);
        if (this.participant == null || this.participant.removeListener == undefined)
            return;
        this.audioUpdateListener &&
            this.participant.removeListener('audioUpdate', this.audioUpdateListener);
        this.videoUpdateListener &&
            this.participant.removeListener('videoUpdate', this.videoUpdateListener);
        this.participant.removeListener('pinned', this.pinnedListener);
        this.participant.removeListener('unpinned', this.pinnedListener);
        this.participant.removeListener('stageStatusUpdate', this.stageListener);
        this.participant.removeListener('toggleTile', this.toggleTileListener);
    }
    meetingChanged(meeting) {
        if (meeting != null) {
            const { self } = meeting;
            this.canDisableParticipantAudio =
                self.permissions.canAllowParticipantAudio || self.permissions.canDisableParticipantAudio;
            this.canDisableParticipantVideo =
                self.permissions.canAllowParticipantVideo || self.permissions.canDisableParticipantVideo;
            this.canKickParticipant = self.permissions.kickParticipant;
            this.canPinParticipant = self.permissions.pinParticipant;
            this.canAllowParticipantOnStage =
                self.permissions.acceptStageRequests && self.permissions.stageEnabled;
            meeting.self.permissions.addListener('permissionsUpdate', this.permissionsUpdateListener);
        }
    }
    participantChanged(participant) {
        var _a;
        if (participant != null) {
            this.audioEnabled = participant.audioEnabled;
            this.videoEnabled = participant.videoEnabled;
            this.isPinned = participant.isPinned;
            this.isHidden = (_a = participant.hidden) !== null && _a !== void 0 ? _a : false;
            this.isOnStage = participant.stageStatus === 'ON_STAGE';
            this.audioUpdateListener = ({ audioEnabled }) => {
                this.audioEnabled = audioEnabled;
            };
            this.videoUpdateListener = ({ videoEnabled }) => {
                this.videoEnabled = videoEnabled;
            };
            if (participant.addListener == undefined)
                return;
            participant.addListener('audioUpdate', this.audioUpdateListener);
            participant.addListener('videoUpdate', this.videoUpdateListener);
            participant.addListener('pinned', this.pinnedListener);
            participant.addListener('unpinned', this.pinnedListener);
            participant.addListener('stageStatusUpdate', this.stageListener);
            this.participant.addListener('toggleTile', this.toggleTileListener);
        }
    }
    render() {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j;
        const isAudioRoom = ((_a = this.meeting) === null || _a === void 0 ? void 0 : _a.meta.viewType) === 'AUDIO_ROOM';
        const isSelf = ((_b = this.meeting) === null || _b === void 0 ? void 0 : _b.self.id) === this.participant.id;
        const showMenu = (this.canDisableParticipantAudio && this.audioEnabled) ||
            (this.canDisableParticipantVideo && this.videoEnabled && !isAudioRoom) ||
            this.canKickParticipant ||
            (this.canPinParticipant && this.isOnStage) ||
            this.canAllowParticipantOnStage;
        const name = formatName(((_c = this.participant) === null || _c === void 0 ? void 0 : _c.name) || '');
        // NOTE(@madhugb): Show some actions for only on stage / non-webinar participants
        // NOTE(@vaibhavshn): Update check after listeners are implemented
        const isActiveParticipant = this.isOnStage || ['GROUP_CALL', 'AUDIO_ROOM'].includes((_d = this.meeting) === null || _d === void 0 ? void 0 : _d.meta.viewType);
        const defaults = {
            meeting: this.meeting,
            size: 'sm',
            states: this.states,
            config: this.config,
            iconPack: this.iconPack,
            t: this.t,
        };
        return (h(Host, { key: '72dec22593ebf143608cd671c2fdf533378acae2' }, h("div", { class: "left", key: (_e = this.participant) === null || _e === void 0 ? void 0 : _e.id }, h("rtk-avatar", { key: 'e71b096c53fe07f425adf1e47d9adb6ee9e7c212', participant: this.participant, size: "sm", iconPack: this.iconPack, t: this.t }), h("p", { key: '492fe90030df26c000d2db3b0355d713e3a8ccf9', class: "name", title: name }, shorten(name, 16), " ", ((_f = this.meeting) === null || _f === void 0 ? void 0 : _f.self.id) === ((_g = this.participant) === null || _g === void 0 ? void 0 : _g.id) && this.t('(you)'))), this.view === 'sidebar' && (h("div", { key: '66ef58575c0c27d7afe631a544a44cb37c526c4c', class: "right" }, isActiveParticipant && (h("rtk-icon", { key: 'adbbf629c1a4f1034127be89c09f8003d3cfe3a7', class: {
                red: !this.audioEnabled,
            }, icon: this.audioEnabled ? this.iconPack.mic_on : this.iconPack.mic_off })), isActiveParticipant && !isAudioRoom && (h("rtk-icon", { key: 'ef0b24e9fb292968c96cb74be8d63f14fde38a44', class: {
                red: !this.videoEnabled,
            }, icon: this.videoEnabled ? this.iconPack.video_on : this.iconPack.video_off })), (showMenu ||
            lenChildren({
                element: 'rtk-participant',
                defaults: defaults}) > 0) && (h("div", { key: '38d52737db83f9c444211e3040cf09f5f47c1513', class: "menu" }, h("span", { key: 'f061992198025919d2bcf14cd1a6eee3f077beaf', id: "trigger", onClick: this.onMenuToggle }, h("rtk-button", { key: '7eb863089acda3f9e20e5aedbcf55742c4b4eb64', variant: "ghost", kind: "icon", slot: "trigger" }, h("rtk-icon", { key: 'a7ff6d6dc9e1139f3b367ab662ad49b79e8258ff', class: "more", icon: this.iconPack.more_vertical }))), h("span", { key: '9188d1538accf4e4769f58580651e0ededa3dd75', id: "menu-list" }, this.menuOpen && (h("rtk-menu-list", { key: 'ef8b7d03841f4920dc7eb295456669975d06ee2f', iconPack: this.iconPack, t: this.t }, this.canPinParticipant && isActiveParticipant && !isAudioRoom && (h("rtk-menu-item", { key: 'd82737dc1227c642ce9c3880fcbe373ff6e0ec0c', onClick: () => {
                if (this.isPinned) {
                    this.participant.unpin();
                }
                else {
                    this.participant.pin();
                }
            }, iconPack: this.iconPack, t: this.t }, h("rtk-icon", { key: '50e63cba1117df61588026b064046779a1e905fb', icon: this.isPinned ? this.iconPack.pin_off : this.iconPack.pin, slot: "start" }), this.isPinned ? this.t('unpin') : this.t('pin'))), isSelf && (h("rtk-menu-item", { key: '662d993d406bd00f014f41425ceb728ab4454ebd', iconPack: this.iconPack, t: this.t, onClick: () => {
                this.isHidden
                    ? this.participant.show()
                    : this.participant.hide();
            } }, h("rtk-icon", { key: '8b296bdb308c3a18a7ec13bca1047277a60b0887', icon: this.isHidden ? this.iconPack.minimize : this.iconPack.maximize, slot: "start" }), !this.meeting.self.hidden ? this.t('minimize') : this.t('maximize'))), this.canDisableParticipantAudio &&
            isActiveParticipant &&
            this.audioEnabled && (h("rtk-menu-item", { key: 'efea4ce4a51bbe2203635e0a95878d80cfe460e4', iconPack: this.iconPack, t: this.t, onClick: () => {
                this.participant.disableAudio();
            } }, h("rtk-icon", { key: 'cdc27b2554c89ef5c3441de551c2bdbf4e91ed72', icon: this.iconPack.mic_off, slot: "start" }), this.t('mute'))), this.canDisableParticipantVideo &&
            isActiveParticipant &&
            this.videoEnabled && (h("rtk-menu-item", { key: '4f1f4e0610cb9fa7a993b824defc71af47711cb1', iconPack: this.iconPack, t: this.t, onClick: () => {
                this.participant.disableVideo();
            } }, h("rtk-icon", { key: '234d891a3ea80dbda3172e8e6a89d71a44676770', icon: this.iconPack.video_off, slot: "start" }), this.t('participants.turn_off_video'))), this.canAllowParticipantOnStage &&
            ((_h = this.participant) === null || _h === void 0 ? void 0 : _h.id) !== ((_j = this.meeting) === null || _j === void 0 ? void 0 : _j.self.id) && (h("rtk-menu-item", { key: '90c465f0f66a792f160b6226714dd07e51c57616', iconPack: this.iconPack, t: this.t, class: this.isOnStage ? 'red' : '', onClick: this.inviteToStageToggle }, h("rtk-icon", { key: 'a5605d8b2864e27817646fc585e6598cd547ca70', icon: this.isOnStage
                ? this.iconPack.leave_stage
                : this.iconPack.join_stage, slot: "start" }), this.isOnStage
            ? this.t('stage.remove_from_stage')
            : this.t('stage.add_to_stage'))), !isSelf && this.canKickParticipant && (h("rtk-menu-item", { key: '0e5fe7c7f6e61599293843466c5b473226348d26', iconPack: this.iconPack, t: this.t, class: "red", onClick: () => {
                var _a, _b, _c;
                (_c = (_a = this.meeting) === null || _a === void 0 ? void 0 : _a.participants.joined.get((_b = this.participant) === null || _b === void 0 ? void 0 : _b.id)) === null || _c === void 0 ? void 0 : _c.kick();
            } }, h("rtk-icon", { key: 'c7d370837be33a1a14fb32f64a35da3fdceafe28', icon: this.iconPack.dismiss, slot: "start" }), this.t('kick'))), h("slot", { key: 'ec5dea9563b71323776808d8ef1991cda87e625f' }, h(Render, { key: '6c423497a1c2f31a7190305913dce0019cf943f1', element: "rtk-participant", defaults: defaults, childProps: {
                participant: this.participant,
            }, deepProps: true, onlyChildren: true })))))))))));
    }
    get host() { return getElement(this); }
    static get watchers() { return {
        "meeting": [{
                "meetingChanged": 0
            }],
        "participant": [{
                "participantChanged": 0
            }]
    }; }
};
__decorate([
    SyncWithStore()
], RtkParticipant.prototype, "meeting", void 0);
__decorate([
    SyncWithStore()
], RtkParticipant.prototype, "states", void 0);
__decorate([
    SyncWithStore()
], RtkParticipant.prototype, "iconPack", void 0);
__decorate([
    SyncWithStore()
], RtkParticipant.prototype, "t", void 0);
__decorate([
    SyncWithStore()
], RtkParticipant.prototype, "config", void 0);
RtkParticipant.style = rtkParticipantCss();

const rtkVirtualizedParticipantListCss = () => `:host{height:100%;width:100%}`;

const RtkVirtualizedParticipantList = class {
    constructor(hostRef) {
        registerInstance(this, hostRef);
        /** Items to be virtualized */
        this.items = [];
        /** Height of each item in pixels (assumed fixed) */
        this.itemHeight = 55; // Mutable so we can update it
        /** Buffer items to render before and after the visible area */
        this.bufferedItemsCount = 5;
        /** Element to render if list is empty */
        this.emptyListElement = null;
        this.visibleStart = 0; // Start of visible items
        this.visibleEnd = 0; // End of visible items
        this.containerHeight = 0; // Height of the container
        this.lastScrollTop = 0; // To track and restore scrollTop
        this.recalculatePositioning = () => {
            // Measure container height and update visible items
            this.updateContainerHeight();
            // Check for the first item height
            requestAnimationFrame(() => {
                this.updateItemHeight();
            });
        };
        this.updateContainerHeight = () => {
            if (!this.el.querySelector('.virtual-list-container').clientHeight) {
                return;
            }
            // Check for the first item height
            requestAnimationFrame(() => {
                this.updateItemHeight();
            });
            this.containerHeight = this.el.querySelector('.virtual-list-container').clientHeight;
            this.updateVisibleRange();
        };
        this.onScroll = debounce(() => {
            const scrollTop = this.el.querySelector('.virtual-list-container').scrollTop;
            if (scrollTop > this.lastScrollTop && this.visibleEnd === this.items.length) {
                return;
            }
            // Track scrollTop for resetting after re-render
            this.lastScrollTop = scrollTop;
            this.updateVisibleRange();
        });
    }
    itemsChanged() {
        this.recalculatePositioning();
    }
    componentDidLoad() {
        this.recalculatePositioning();
        // Set up the scroll event listener
        this.el.querySelector('.virtual-list-container').addEventListener('scroll', this.onScroll);
        window.addEventListener('resize', this.recalculatePositioning);
    }
    componentDidUpdate() {
        // Update item height if it changes
        this.updateItemHeight();
    }
    disconnectedCallback() {
        // Remove event listeners to prevent memory leaks
        this.el.querySelector('.virtual-list-container').removeEventListener('scroll', this.onScroll);
        window.removeEventListener('resize', this.recalculatePositioning);
    }
    updateVisibleRange() {
        // Get the current scroll position
        const scrollTop = this.el.querySelector('.virtual-list-container').scrollTop;
        // Calculate the start and end of visible items based on scroll position and item height
        const startIndex = Math.floor(scrollTop / this.itemHeight);
        // Calculate the number of fully visible items and include an extra one if there's a partially visible one
        const visibleCount = Math.ceil(this.containerHeight / this.itemHeight);
        // The end index should include the buffer and partially visible item
        const endIndex = Math.min(this.items.length, startIndex + visibleCount + this.bufferedItemsCount);
        // Update the visible range in the component's state
        this.visibleStart = startIndex;
        this.visibleEnd = endIndex;
        // Reset the scroll position to ensure smooth rendering
        this.el.querySelector('.virtual-list-container').scrollTop = this.lastScrollTop;
    }
    updateItemHeight() {
        // Get the first rendered item
        const firstRenderedItem = this.el.querySelector('.virtual-list-item');
        if (firstRenderedItem) {
            // Temporarily remove the height style to let the browser compute natural height
            const originalHeight = firstRenderedItem.style.height;
            firstRenderedItem.style.height = 'auto'; // Let it take natural height
            // Measure the natural height
            const naturalHeight = firstRenderedItem.getBoundingClientRect().height;
            // Reapply the original height (if needed)
            if (originalHeight) {
                firstRenderedItem.style.height = originalHeight;
            }
            // Check if the measured height differs from the current itemHeight
            if (naturalHeight && Math.floor(naturalHeight) !== Math.floor(this.itemHeight)) {
                this.itemHeight = naturalHeight;
            }
        }
    }
    renderItems() {
        // Slice the items array to only render the visible and buffered items
        const visibleItems = this.items.slice(this.visibleStart, this.visibleEnd);
        // Render each visible item at the correct position using absolute positioning
        return visibleItems.map((item, index) => {
            const itemIndex = this.visibleStart + index;
            return (h("div", { class: "virtual-list-item", key: item.id, style: {
                    position: 'absolute',
                    top: `${itemIndex * this.itemHeight}px`,
                    height: `${this.itemHeight}px`,
                    width: '100%',
                } }, this.renderItem(item, itemIndex)));
        });
    }
    render() {
        var _a;
        const totalHeight = this.items.length * this.itemHeight; // Total height of the list
        return (h("div", { key: '279498eedaa6605456a2fffc004bd0204179ffde', class: "virtual-list-container", style: {
                position: 'relative',
                height: '100%',
                overflowX: 'hidden',
                overflowY: 'auto',
            } }, h("div", { key: 'debb114c51c7c229b72cfcd7e87aa845ab6647e1', style: { height: `${totalHeight}px`, position: 'relative' } }, !((_a = this.items) === null || _a === void 0 ? void 0 : _a.length) ? this.emptyListElement : this.renderItems()), h("div", { key: '7a97a5dd632fe6d4227674e46e091a1466c725bf', style: { height: `${this.itemHeight}px` } })));
    }
    get el() { return getElement(this); }
    static get watchers() { return {
        "items": [{
                "itemsChanged": 0
            }]
    }; }
};
RtkVirtualizedParticipantList.style = rtkVirtualizedParticipantListCss();

export { RtkParticipant as rtk_participant, RtkVirtualizedParticipantList as rtk_virtualized_participant_list };

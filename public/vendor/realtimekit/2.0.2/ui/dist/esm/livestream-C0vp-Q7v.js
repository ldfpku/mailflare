/**
 * Can view the livestream
 */
const isLiveStreamViewer = (meeting) => {
    if (!showLivestream(meeting))
        return false;
    return meeting.meta.viewType === 'LIVESTREAM' && meeting.stage.status !== 'ON_STAGE';
};
/**
 * Can start/stop the livestream
 */
const isLiveStreamHost = (meeting) => {
    var _a;
    if (!showLivestream(meeting))
        return false;
    return meeting.meta.viewType === 'LIVESTREAM' && ((_a = meeting === null || meeting === void 0 ? void 0 : meeting.self) === null || _a === void 0 ? void 0 : _a.permissions.canLivestream);
};
const showLivestream = (meeting) => {
    return !!(meeting === null || meeting === void 0 ? void 0 : meeting.livestream);
};
var PlayerState;
(function (PlayerState) {
    PlayerState["BUFFERING"] = "Buffering";
    PlayerState["ENDED"] = "Ended";
    PlayerState["IDLE"] = "Idle";
    PlayerState["PAUSED"] = "Paused";
    PlayerState["PLAYING"] = "Playing";
    PlayerState["READY"] = "Ready";
})(PlayerState || (PlayerState = {}));
var PlayerEventType;
(function (PlayerEventType) {
    PlayerEventType["INITIALIZED"] = "PlayerInitialized";
    PlayerEventType["QUALITY_CHANGED"] = "PlayerQualityChanged";
    PlayerEventType["DURATION_CHANGED"] = "PlayerDurationChanged";
    PlayerEventType["VOLUME_CHANGED"] = "PlayerVolumeChanged";
    PlayerEventType["MUTED_CHANGED"] = "PlayerMutedChanged";
    PlayerEventType["PLAYBACK_RATE_CHANGED"] = "PlayerPlaybackRateChanged";
    PlayerEventType["REBUFFERING"] = "PlayerRebuffering";
    PlayerEventType["AUDIO_BLOCKED"] = "PlayerAudioBlocked";
    PlayerEventType["PLAYBACK_BLOCKED"] = "PlayerPlaybackBlocked";
    PlayerEventType["ERROR"] = "PlayerError";
    PlayerEventType["RECOVERABLE_ERROR"] = "PlayerRecoverableError";
    PlayerEventType["ANALYTICS_EVENT"] = "PlayerAnalyticsEvent";
    PlayerEventType["TIME_UPDATE"] = "PlayerTimeUpdate";
    PlayerEventType["BUFFER_UPDATE"] = "PlayerBufferUpdate";
    PlayerEventType["SEEK_COMPLETED"] = "PlayerSeekCompleted";
    PlayerEventType["SESSION_DATA"] = "PlayerSessionData";
    PlayerEventType["STATE_CHANGED"] = "PlayerStateChanged";
    PlayerEventType["WORKER_ERROR"] = "PlayerWorkerError";
    PlayerEventType["METADATA"] = "PlayerMetadata";
    PlayerEventType["TEXT_CUE"] = "PlayerTextCue";
    PlayerEventType["TEXT_METADATA_CUE"] = "PlayerTextMetadataCue";
    PlayerEventType["AD_CUE"] = "PlayerAdCue";
    PlayerEventType["STREAM_SOURCE_CUE"] = "PlayerStreamSourceCue";
    PlayerEventType["NETWORK_UNAVAILABLE"] = "PlayerNetworkUnavailable";
    PlayerEventType["SEGMENT_DISCONTINUITY"] = "PlayerSegmentDiscontinuity";
    PlayerEventType["SEGMENT_METADATA"] = "PlayerSegmentMetadata";
    PlayerEventType["PLAYER_METADATA"] = "PlayerMetadata";
})(PlayerEventType || (PlayerEventType = {}));
function getLivestreamViewerAllowedQualityLevels({ meeting, hlsLevels, }) {
    let allowedQualities = meeting.self.config.livestreamViewerQualities || [];
    if (!allowedQualities.length) {
        return { autoLevelChangeAllowed: true, levels: hlsLevels };
    }
    // Filter allowed qualities
    const desiredLevels = hlsLevels.filter((level) => allowedQualities.includes(level.height));
    if (!desiredLevels.length) {
        return { autoLevelChangeAllowed: true, levels: hlsLevels };
    }
    return { autoLevelChangeAllowed: false, levels: desiredLevels };
}

export { PlayerState as P, isLiveStreamViewer as a, getLivestreamViewerAllowedQualityLevels as g, isLiveStreamHost as i, showLivestream as s };

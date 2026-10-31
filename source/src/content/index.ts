import { normalizeSettings } from '../shared/settings.ts';
import { watchPrivacyConsent } from '../shared/privacy-consent.ts';
import { watchSettings } from '../shared/storage.ts';
import { applyAvatarShape, applySettings } from './apply-settings.ts';
import { isRoadmapReleaseView, isSpectrumHome, sectionForPath } from '../shared/site-sections.ts';
import { installHangarControls } from './hangar-controls.ts';
import { installHangarImagePreview } from './hangar-image.ts';
import { installHangarSearch } from './hangar-search.ts';
import { installConversation } from './spectrum-conversation.ts';
import { installReplyContexts } from './spectrum-reply-context.ts';
import { installEnhancedBlocks } from './spectrum-blocks.ts';
import { installHangarView } from './hangar-view.ts';
import { installHangarTitles } from './hangar-titles.ts';
import { installHangarFavorites } from './hangar-favorites.ts';
import { installCommLinkControls } from './commlink-controls.ts';
import { createSpectrumChannelLabelController } from './spectrum-sidebar-labels.ts';
import { createSpectrumSidebarEmptyStateController } from './spectrum-sidebar-empty.ts';
import { createSpectrumMessagesSummaryController } from './spectrum-messages-summary.ts';
import { installSpectrumNotificationFilters } from './spectrum-notifications.ts';
import { installSpectrumSavedThreads } from './spectrum-saved-threads.ts';
import { installSpectrumChatMessageGroups } from './spectrum-chat-groups.ts';
import { installFundingStatsDeltas } from './funding-stats.ts';
import { installDevTrackerContext } from './devtracker-context.ts';
import { installOrganizationProfile } from './organization-profile.ts';
import { installRoadmapImageViewer } from './roadmap-image-viewer.ts';
import { installRoadmapCardMetadata } from './roadmap-card-metadata.ts';
import { installRoadmapStatusPresentation } from './roadmap-status-presentation.ts';
import { installRoadmapSearch } from './roadmap-search.ts';
import { installRoadmapVersionHeader } from './roadmap-version-header.ts';
import { installRoadmapLandingPreference } from './roadmap-landing.ts';

type Refresh = () => void;
type ToggleRefresh = (enabled: boolean) => void;

let settings = normalizeSettings();
let consentActive = false;
let controllersInitialized = false;
let settingsCleanup: (() => void) | undefined;
let roadmapLandingCleanup: (() => void) | undefined;
let settingsEpoch = 0;
let activeSection: ReturnType<typeof sectionForPath> = null;
let hangarPaintMode = false;

let refreshChannelLabels: ToggleRefresh | undefined;
let refreshSpectrumSidebarEmptyStates: ToggleRefresh | undefined;
let refreshSpectrumMessagesSummary: ToggleRefresh | undefined;
let refreshNotificationFilters: Refresh | undefined;
let refreshSavedThreads: Refresh | undefined;
let refreshChatMessageGroups: Refresh | undefined;
let refreshHangar: Refresh | undefined;
let refreshImages: Refresh | undefined;
let refreshSearch: Refresh | undefined;
let refreshConversation: Refresh | undefined;
let refreshReplyContexts: Refresh | undefined;
let refreshBlocks: Refresh | undefined;
let refreshView: Refresh | undefined;
let refreshTitles: Refresh | undefined;
let refreshFavorites: Refresh | undefined;
let refreshCommLinkControls: Refresh | undefined;
let refreshFundingStats: Refresh | undefined;
let refreshDevTrackerContext: Refresh | undefined;
let refreshOrganizationProfile: Refresh | undefined;
let refreshRoadmapImageViewer: Refresh | undefined;
let refreshRoadmapCardMetadata: Refresh | undefined;
let refreshRoadmapStatusPresentation: Refresh | undefined;
let refreshRoadmapSearch: Refresh | undefined;
let refreshRoadmapVersionHeader: Refresh | undefined;

const roadmapReleaseViewEnabled = () => activeSection === 'roadmap' && isRoadmapReleaseView(location.pathname) && settings.rsi.roadmap;

function initializeControllers(): void {
  if (controllersInitialized) return;
  refreshChannelLabels = createSpectrumChannelLabelController(
    document,
    () => consentActive && location.pathname.toLowerCase().includes('/lobby/'),
    window,
  );
  refreshSpectrumSidebarEmptyStates = createSpectrumSidebarEmptyStateController(document, window);
  refreshSpectrumMessagesSummary = createSpectrumMessagesSummaryController(document, window);
  refreshNotificationFilters = installSpectrumNotificationFilters(
    () => consentActive && activeSection === 'spectrum' && settings.modules.notifications,
  );
  refreshSavedThreads = installSpectrumSavedThreads(
    () => consentActive && activeSection === 'spectrum' && settings.modules.savedThreads,
    window,
    document,
  );
  refreshChatMessageGroups = installSpectrumChatMessageGroups(
    () => consentActive && activeSection === 'spectrum' && settings.modules.chat && location.pathname.toLowerCase().includes('/lobby/'),
    document,
  );
  refreshHangar = installHangarControls(() => consentActive && activeSection === 'hangar' && settings.rsi.hangar);
  refreshImages = installHangarImagePreview(() => consentActive && activeSection === 'hangar' && settings.rsi.hangar);
  refreshSearch = installHangarSearch(
    () => consentActive && activeSection === 'hangar' && settings.rsi.hangar,
    window,
    document,
    paintMode => {
      hangarPaintMode = paintMode;
      refreshImages?.();
      refreshTitles?.();
      refreshFavorites?.();
    },
  );
  refreshConversation = installConversation(() => consentActive && activeSection === 'spectrum' && settings.modules.forums);
  refreshReplyContexts = installReplyContexts(
    () => consentActive && activeSection === 'spectrum' && settings.modules.forums && settings.commentLayout === 'conversation',
    window,
    document,
  );
  refreshBlocks = installEnhancedBlocks(() => consentActive && activeSection === 'spectrum' && settings.modules.blocks);
  refreshView = installHangarView(() => consentActive && activeSection === 'hangar' && settings.rsi.hangar);
  refreshTitles = installHangarTitles(() => consentActive && activeSection === 'hangar' && settings.rsi.hangar);
  refreshFavorites = installHangarFavorites(
    () => consentActive && activeSection === 'hangar' && settings.rsi.hangar,
    window,
    document,
    () => hangarPaintMode,
  );
  refreshCommLinkControls = installCommLinkControls(() => consentActive && activeSection === 'commlink' && settings.rsi.commlink);
  refreshFundingStats = installFundingStatsDeltas(() => consentActive && activeSection === 'funding' && settings.rsi.funding);
  refreshDevTrackerContext = installDevTrackerContext(() => consentActive && activeSection === 'devtracker' && settings.rsi.devtracker);
  refreshOrganizationProfile = installOrganizationProfile(() => consentActive && activeSection === 'organizations' && settings.rsi.organizations);
  refreshRoadmapImageViewer = installRoadmapImageViewer(roadmapReleaseViewEnabled, window, document);
  refreshRoadmapCardMetadata = installRoadmapCardMetadata(roadmapReleaseViewEnabled, window, document);
  refreshRoadmapStatusPresentation = installRoadmapStatusPresentation(roadmapReleaseViewEnabled, window, document);
  refreshRoadmapSearch = installRoadmapSearch(roadmapReleaseViewEnabled, window, document);
  refreshRoadmapVersionHeader = installRoadmapVersionHeader(roadmapReleaseViewEnabled, window, document);
  controllersInitialized = true;
}

function refreshRoute(): void {
  if (!consentActive) return;
  const root = document.documentElement;
  if (!root) return;
  activeSection = sectionForPath(location.pathname);
  refreshChannelLabels?.(activeSection === 'spectrum' && settings.modules.chat);
  refreshNotificationFilters?.();
  refreshSavedThreads?.();
  refreshChatMessageGroups?.();
  window.requestAnimationFrame(() => {
    if (consentActive) refreshChannelLabels?.(sectionForPath(location.pathname) === 'spectrum' && settings.modules.chat);
  });
  root.dataset.rsiSection = activeSection ?? 'none';
  root.dataset.rsiSpectrumHome = String(activeSection === 'spectrum' && isSpectrumHome(location.pathname));
  refreshSpectrumSidebarEmptyStates?.(activeSection === 'spectrum' && settings.modules.theme);
  refreshSpectrumMessagesSummary?.(activeSection === 'spectrum' && settings.modules.messages);
  if (activeSection) applySettings(settings, root);
  else applyAvatarShape(settings, root);
  refreshHangar?.();
  refreshImages?.();
  refreshSearch?.();
  refreshConversation?.();
  refreshReplyContexts?.();
  refreshBlocks?.();
  refreshView?.();
  refreshTitles?.();
  refreshFavorites?.();
  refreshCommLinkControls?.();
  refreshFundingStats?.();
  refreshDevTrackerContext?.();
  refreshOrganizationProfile?.();
  refreshRoadmapImageViewer?.();
  refreshRoadmapCardMetadata?.();
  refreshRoadmapStatusPresentation?.();
  refreshRoadmapSearch?.();
  refreshRoadmapVersionHeader?.();
}

function stopRouteListeners(): void {
  document.removeEventListener('DOMContentLoaded', refreshRoute);
  window.navigation?.removeEventListener('navigatesuccess', refreshRoute);
  window.removeEventListener('popstate', refreshRoute);
}

function deactivateFeatures(): void {
  if (!consentActive) return;
  consentActive = false;
  settingsEpoch++;
  settingsCleanup?.();
  settingsCleanup = undefined;
  roadmapLandingCleanup?.();
  roadmapLandingCleanup = undefined;
  stopRouteListeners();
  activeSection = null;
  refreshChannelLabels?.(false);
  refreshSpectrumSidebarEmptyStates?.(false);
  refreshSpectrumMessagesSummary?.(false);
  refreshNotificationFilters?.();
  refreshSavedThreads?.();
  refreshChatMessageGroups?.();
  refreshHangar?.();
  refreshImages?.();
  refreshSearch?.();
  refreshConversation?.();
  refreshReplyContexts?.();
  refreshBlocks?.();
  refreshView?.();
  refreshTitles?.();
  refreshFavorites?.();
  refreshCommLinkControls?.();
  refreshFundingStats?.();
  refreshDevTrackerContext?.();
  refreshOrganizationProfile?.();
  refreshRoadmapImageViewer?.();
  refreshRoadmapCardMetadata?.();
  refreshRoadmapStatusPresentation?.();
  refreshRoadmapSearch?.();
  refreshRoadmapVersionHeader?.();

  const root = document.documentElement;
  if (!root) return;
  root.dataset.rsiSection = 'none';
  root.dataset.rsiSpectrumHome = 'false';
  root.removeAttribute('data-rsi-consent');
  root.removeAttribute('data-rsi-avatar');
  root.style.removeProperty('--rsi-avatar-radius');
}

function activateFeatures(): void {
  if (consentActive) return;
  consentActive = true;
  const root = document.documentElement;
  root?.setAttribute('data-rsi-consent', 'accepted');
  initializeControllers();
  document.addEventListener('DOMContentLoaded', refreshRoute, { once: true });
  window.navigation?.addEventListener('navigatesuccess', refreshRoute);
  window.addEventListener('popstate', refreshRoute);

  let resolveSettingsReady!: () => void;
  const settingsReady = new Promise<void>(resolve => { resolveSettingsReady = resolve; });
  roadmapLandingCleanup = installRoadmapLandingPreference(document, window, () => settings.roadmapLandingView, settingsReady);
  const epoch = ++settingsEpoch;
  void watchSettings(value => {
    if (!consentActive || epoch !== settingsEpoch) return;
    settings = value;
    resolveSettingsReady();
    refreshRoute();
  }).then(cleanup => {
    if (!consentActive || epoch !== settingsEpoch) cleanup();
    else settingsCleanup = cleanup;
  }).catch((error: unknown) => {
    if (!consentActive || epoch !== settingsEpoch) return;
    resolveSettingsReady();
    console.warn('[RSI Enhanced] Could not load preferences; using defaults.', error);
    refreshRoute();
  });
  refreshRoute();
}

watchPrivacyConsent(chrome.storage.local, chrome.storage.onChanged, accepted => {
  if (accepted) activateFeatures();
  else deactivateFeatures();
});

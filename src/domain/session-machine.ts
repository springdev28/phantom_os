import type { ApplicationPackage, CompatibilityPlan, Inspection } from './contracts';
import type { ErrorCode } from './errors';

interface Selection { readonly pkg: ApplicationPackage; }
interface Review extends Selection {
  readonly inspection: Inspection;
  readonly plan: CompatibilityPlan;
}
export type SessionState =
  | { readonly status: 'idle' }
  | ({ readonly status: 'selected' } & Selection)
  | ({ readonly status: 'inspecting'; readonly jobId: string } & Selection)
  | ({ readonly status: 'ready' | 'unsupported' } & Review)
  | ({ readonly status: 'preparing' } & Review)
  | ({ readonly status: 'running'; readonly sessionId: string } & Review)
  | ({ readonly status: 'stopped' } & Review)
  | ({ readonly status: 'error'; readonly code: ErrorCode } & Review)
  | { readonly status: 'error'; readonly code: ErrorCode; readonly pkg?: ApplicationPackage };

export type SessionAction =
  | { type: 'SELECT'; pkg: ApplicationPackage }
  | { type: 'INSPECT'; jobId: string }
  | { type: 'INSPECTED'; jobId: string; inspection: Inspection; plan: CompatibilityPlan; pkg?: ApplicationPackage }
  | { type: 'CHOOSE_ENTRYPOINT'; path: string }
  | { type: 'REPLAN'; packageId: string; plan: CompatibilityPlan; pkg?: ApplicationPackage }
  | { type: 'CANCEL_INSPECTION' }
  | { type: 'PREPARE' }
  | { type: 'STARTED'; sessionId: string }
  | { type: 'STOP' }
  | { type: 'RUNTIME_FAIL'; code: ErrorCode }
  | { type: 'FAIL'; code: ErrorCode; jobId?: string }
  | { type: 'CLEAR' };

export const initialSession: SessionState = { status: 'idle' };

function launchEligible(plan: CompatibilityPlan): boolean {
  return plan.canLaunch && plan.engineInstalled && !plan.issues.some(issue => issue.blocking)
    && Boolean(plan.runtimeId && plan.runtimeBuildId && plan.entrypoint)
    && ['candidate', 'experimental', 'verified-compatible'].includes(plan.decision)
    && (plan.decision !== 'verified-compatible' || Boolean(plan.verificationRecordId));
}

/** Illegal and stale events are ignored. Only a real adapter may dispatch STARTED. */
export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'CLEAR': return initialSession;
    case 'SELECT': return { status: 'selected', pkg: action.pkg };
    case 'INSPECT':
      return state.status === 'selected'
        ? { status: 'inspecting', pkg: state.pkg, jobId: action.jobId } : state;
    case 'INSPECTED':
      if (state.status !== 'inspecting' || state.jobId !== action.jobId) return state;
      return {
        status: launchEligible(action.plan) ? 'ready' : 'unsupported',
        pkg: action.pkg ?? state.pkg, inspection: action.inspection, plan: action.plan,
      };
    case 'CHOOSE_ENTRYPOINT':
      if ((state.status !== 'unsupported' && state.status !== 'ready')
        || !state.pkg.candidates.some(candidate => candidate.path === action.path)) return state;
      // A choice is metadata, never launch authorization. A future planner must reassess it.
      return { ...state, status: 'unsupported', pkg: { ...state.pkg, entrypoint: action.path },
        plan: { ...state.plan, canLaunch: false, entrypoint: action.path } };
    case 'REPLAN':
      if (!('inspection' in state) || !['unsupported', 'ready', 'stopped', 'error'].includes(state.status) || state.pkg.id !== action.packageId
        || (action.pkg && action.pkg.id !== state.pkg.id)) return state;
      return { ...state, pkg: action.pkg ?? state.pkg, plan: action.plan, status: launchEligible(action.plan) ? 'ready' : 'unsupported' };
    case 'CANCEL_INSPECTION':
      return state.status === 'inspecting' ? { status: 'selected', pkg: state.pkg } : state;
    case 'PREPARE':
      return 'plan' in state && ['ready', 'stopped', 'error'].includes(state.status) && launchEligible(state.plan)
        ? { ...state, status: 'preparing' } : state;
    case 'STARTED':
      return state.status === 'preparing' && action.sessionId.length > 0
        ? { ...state, status: 'running', sessionId: action.sessionId } : state;
    case 'STOP':
      return state.status === 'running' || state.status === 'preparing'
        ? { status: 'stopped', pkg: state.pkg, inspection: state.inspection, plan: state.plan } : state;
    case 'RUNTIME_FAIL':
      return 'inspection' in state && ['preparing', 'running'].includes(state.status)
        ? { status: 'error', code: action.code, pkg: state.pkg, inspection: state.inspection, plan: state.plan } : state;
    case 'FAIL': {
      if (action.jobId && (state.status !== 'inspecting' || state.jobId !== action.jobId)) return state;
      const pkg = 'pkg' in state ? state.pkg : undefined;
      return { status: 'error', code: action.code, ...(pkg ? { pkg } : {}) };
    }
  }
}

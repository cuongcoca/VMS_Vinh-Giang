/**
 * Barrel export cho toàn bộ UI components nền tảng.
 *
 * Sử dụng:
 *   import { Button, Input, Modal, useToast, useConfirm } from "@/components/ui";
 */

export { Button, type ButtonVariant, type ButtonSize } from "./Button";
export { Input, type InputVariant, type InputSize } from "./Input";
export { Textarea } from "./Textarea";
export { Select, type SelectVariant, type SelectSize } from "./Select";
export { FormField } from "./FormField";
export { Modal, type ModalSize } from "./Modal";
export { ConfirmProvider, useConfirm, type ConfirmVariant, type ConfirmOptions } from "./ConfirmDialog";
export { ToastProvider, useToast, type ToastVariant } from "./Toast";
export { Spinner, PageLoader, type SpinnerSize } from "./Spinner";
export { EmptyState } from "./EmptyState";
export { ErrorState } from "./ErrorState";
export { Pagination } from "./Pagination";
export { useClientPagination, ListPageFooter } from "./ListPagination";
export { Stepper, type StepperStep } from "./Stepper";
export { Tabs, type TabItem } from "./Tabs";
export { Card } from "./Card";
export { Badge } from "./Badge";

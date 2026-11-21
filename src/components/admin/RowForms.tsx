'use client';

import { useState, type FormEvent } from 'react';
import type { AddonDraft, DishDraft, FaqDraft } from '@/admin/types';
import type { AddonValues, DishValues, FaqValues } from '@/admin/repository';
import {
  validateAddon,
  validateDish,
  validateFaq,
  type AddonField,
  type DishField,
  type FaqField,
} from '@/admin/validation/content';
import { useQuery } from './AdminProvider';
import { CheckField, ErrorSummary, TextAreaField, TextField } from './fields';
import type { RowFormProps } from './ListManager';
import { MediaPicker } from './MediaPicker';

function useSubmit<V>(onSave: (values: V) => Promise<void>) {
  const [serverError, setServerError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  async function run(values: V) {
    setServerError(null);
    setSaving(true);
    try {
      await onSave(values);
    } catch (e) {
      setServerError(e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }
  return { serverError, saving, run };
}

function FormButtons({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="cta-row">
      <button type="submit" className="btn btn-primary" disabled={saving}>
        Save
      </button>
      <button type="button" className="btn btn-secondary" onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

export function DishForm({ row, onSave, onCancel }: RowFormProps<DishDraft, DishValues>) {
  const [name, setName] = useState(row?.name ?? '');
  const [comesWith, setComesWith] = useState(row?.comesWith ?? '');
  const [price, setPrice] = useState(row ? String(row.price) : '');
  const [shown, setShown] = useState(row ? !row.isHidden : true);
  const [mediaId, setMediaId] = useState<string | null>(row?.mediaId ?? null);
  const [picker, setPicker] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<DishField, string>>>({});
  const { serverError, saving, run } = useSubmit(onSave);
  const media = useQuery((repo) => repo.listMedia());
  const chosen =
    media.state.status === 'ready' ? media.state.data.find((m) => m.id === mediaId) : undefined;

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateDish({ name, comesWith, price, isHidden: !shown });
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    void run({ ...result.value, mediaId });
  }

  return (
    <form noValidate onSubmit={submit}>
      <ErrorSummary
        errors={errors}
        serverError={serverError}
        labels={{
          name: { id: 'dish-name', label: 'Dish name' },
          comesWith: { id: 'dish-comes', label: 'Comes with' },
          price: { id: 'dish-price', label: 'Price' },
        }}
      />
      <TextField
        id="dish-name"
        label="Dish name"
        required
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <TextField
        id="dish-comes"
        label="Comes with"
        value={comesWith}
        onChange={setComesWith}
        error={errors.comesWith}
      />
      <TextField
        id="dish-price"
        label="Price (Rs)"
        required
        inputMode="numeric"
        maxWidth="10rem"
        value={price}
        onChange={setPrice}
        error={errors.price}
      />
      <div className="field">
        <span className="lbl">Photo (optional)</span>
        <div className="ph" style={{ minHeight: '4rem', justifyContent: 'flex-start' }}>
          <span>
            {chosen ? `Chosen: ${chosen.altText}` : 'No photo chosen.'}{' '}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setPicker(true)}
            >
              Choose from images
            </button>
          </span>
        </div>
      </div>
      <CheckField id="dish-shown" label="Show on the website" checked={shown} onChange={setShown} />
      <FormButtons saving={saving} onCancel={onCancel} />
      <MediaPicker
        key={String(picker)}
        open={picker}
        selectedId={mediaId}
        onSelect={setMediaId}
        onClose={() => setPicker(false)}
      />
    </form>
  );
}

export function AddonForm({ row, onSave, onCancel }: RowFormProps<AddonDraft, AddonValues>) {
  const [name, setName] = useState(row?.name ?? '');
  const [price, setPrice] = useState(row ? String(row.price) : '');
  const [shown, setShown] = useState(row ? !row.isHidden : true);
  const [errors, setErrors] = useState<Partial<Record<AddonField, string>>>({});
  const { serverError, saving, run } = useSubmit(onSave);

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateAddon({ name, price, isHidden: !shown });
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    void run(result.value);
  }

  return (
    <form noValidate onSubmit={submit}>
      <ErrorSummary
        errors={errors}
        serverError={serverError}
        labels={{
          name: { id: 'addon-name', label: 'Add-on name' },
          price: { id: 'addon-price', label: 'Price' },
        }}
      />
      <TextField
        id="addon-name"
        label="Add-on name"
        required
        value={name}
        onChange={setName}
        error={errors.name}
      />
      <TextField
        id="addon-price"
        label="Price (Rs)"
        required
        inputMode="numeric"
        maxWidth="10rem"
        value={price}
        onChange={setPrice}
        error={errors.price}
      />
      <CheckField
        id="addon-shown"
        label="Show on the website"
        checked={shown}
        onChange={setShown}
      />
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  );
}

export function FaqForm({ row, onSave, onCancel }: RowFormProps<FaqDraft, FaqValues>) {
  const [question, setQuestion] = useState(row?.question ?? '');
  const [answer, setAnswer] = useState(row?.answer ?? '');
  const [shown, setShown] = useState(row ? !row.isHidden : true);
  const [errors, setErrors] = useState<Partial<Record<FaqField, string>>>({});
  const { serverError, saving, run } = useSubmit(onSave);

  function submit(e: FormEvent) {
    e.preventDefault();
    const result = validateFaq({ question, answer, isHidden: !shown });
    if (!result.ok) return setErrors(result.errors);
    setErrors({});
    void run(result.value);
  }

  return (
    <form noValidate onSubmit={submit}>
      <ErrorSummary
        errors={errors}
        serverError={serverError}
        labels={{
          question: { id: 'faq-question', label: 'Question' },
          answer: { id: 'faq-answer', label: 'Answer' },
        }}
      />
      <TextField
        id="faq-question"
        label="Question"
        required
        value={question}
        onChange={setQuestion}
        error={errors.question}
      />
      <TextAreaField
        id="faq-answer"
        label="Answer"
        required
        rows={4}
        value={answer}
        onChange={setAnswer}
        hint="Plain text only. Links and formatting are not supported."
        error={errors.answer}
      />
      <CheckField id="faq-shown" label="Show on the website" checked={shown} onChange={setShown} />
      <FormButtons saving={saving} onCancel={onCancel} />
    </form>
  );
}

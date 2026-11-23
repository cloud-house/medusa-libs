import { defineWidgetConfig } from '@medusajs/admin-sdk'
import type { AdminOrder, DetailWidgetProps } from '@medusajs/framework/types'
import { Button, Container, Heading, Text, toast, usePrompt } from '@medusajs/ui'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AdminCorrectionView, AdminInvoiceResponse } from '../../lib/admin-view'
import { correctionKsefHint, correctionLabel, invoiceLabels } from '../lib/invoice-labels'
import { type InvoiceAction, invoiceActionToast } from '../lib/invoice-toast'
import { errorMessage, sdk } from '../lib/sdk'

/** Colour of a credit note's line: a note that needs a person stands out, one in the making fades. */
const CORRECTION_TONE: Record<AdminCorrectionView['status'], string | undefined> = {
  issued: undefined,
  waiting: 'text-ui-fg-subtle',
  issuing: 'text-ui-fg-subtle',
  attention: 'text-ui-fg-error',
  failed: 'text-ui-fg-error',
}

/** „Faktura” card on the order page (spec 6c §5.7); lists the credit notes of returns (spec 6e-b, D12). */
const OrderInvoiceWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const key = ['fakturownia', 'invoice', order.id]
  const path = `/admin/orders/${order.id}/invoice`
  const card = useQuery({
    queryKey: key,
    queryFn: () => sdk.client.fetch<AdminInvoiceResponse>(path),
  })
  const run = useMutation({
    mutationFn: (action: InvoiceAction) =>
      sdk.client.fetch<AdminInvoiceResponse>(`${path}/${action}`, { method: 'POST' }),
    onSuccess: (data, action) => {
      queryClient.setQueryData(key, data)
      const { kind, text } = invoiceActionToast(action, data)
      toast[kind](text)
    },
    onError: (error) => {
      toast.error(errorMessage(error))
      queryClient.invalidateQueries({ queryKey: key })
    },
  })

  if (!card.data) return null
  const labels = invoiceLabels(card.data)
  const { actions, corrections, invoice } = card.data
  const ksefHint = correctionKsefHint(card.data.ksefMode && { ksef: card.data.ksefMode })
  const issueLabel = invoice ? 'Wystaw ponownie' : 'Wystaw fakturę'

  async function resend() {
    const confirmed = await prompt({
      title: 'Wysłać fakturę ponownie?',
      description: 'Klient dostanie jeszcze jeden mail z fakturą w załączniku.',
      confirmText: 'Wyślij',
      cancelText: 'Anuluj',
    })
    if (confirmed) run.mutate('email')
  }

  return (
    <Container className="flex flex-col gap-2 px-6 py-4">
      <Heading level="h2">Faktura</Heading>
      <Text size="small">{labels.status}</Text>
      {labels.ksef && (
        <Text size="small" className="text-ui-fg-subtle">
          {labels.ksef}
        </Text>
      )}
      {labels.email && (
        <Text size="small" className="text-ui-fg-subtle">
          {labels.email}
        </Text>
      )}
      {labels.warning && (
        <Text size="small" className="text-ui-fg-error">
          {labels.warning}
        </Text>
      )}
      {corrections.length > 0 && (
        <div className="flex flex-col gap-1 pt-2">
          <Text size="small" weight="plus">
            Korekty
          </Text>
          {corrections.map((correction) => (
            <Text
              key={correction.returnId}
              size="small"
              className={CORRECTION_TONE[correction.status]}
            >
              {correctionLabel(correction)}
              {correction.fakturowniaUrl && (
                <>
                  {' – '}
                  <a
                    href={correction.fakturowniaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-ui-fg-interactive"
                  >
                    Otwórz w Fakturowni
                  </a>
                </>
              )}
            </Text>
          ))}
          {ksefHint && (
            <Text size="small" className="text-ui-fg-subtle">
              {ksefHint}
            </Text>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2 pt-1">
        {actions.pdf && (
          <Button size="small" variant="secondary" asChild>
            <a href={`${path}/pdf`}>Pobierz PDF</a>
          </Button>
        )}
        {invoice?.fakturowniaUrl && (
          <Button size="small" variant="secondary" asChild>
            <a href={invoice.fakturowniaUrl} target="_blank" rel="noreferrer">
              Otwórz w Fakturowni
            </a>
          </Button>
        )}
        {actions.issue && (
          <Button
            size="small"
            variant="secondary"
            isLoading={run.isPending && run.variables === 'issue'}
            onClick={() => run.mutate('issue')}
          >
            {issueLabel}
          </Button>
        )}
        {actions.recheck && (
          <Button
            size="small"
            variant="secondary"
            isLoading={run.isPending && run.variables === 'recheck'}
            onClick={() => run.mutate('recheck')}
          >
            Sprawdź ponownie
          </Button>
        )}
        {actions.resendEmail && (
          <Button
            size="small"
            variant="secondary"
            isLoading={run.isPending && run.variables === 'email'}
            onClick={resend}
          >
            Wyślij mail ponownie
          </Button>
        )}
      </div>
    </Container>
  )
}

export const config = defineWidgetConfig({ zone: 'order.details.side.before' })

export default OrderInvoiceWidget

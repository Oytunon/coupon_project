-- Supabase SQL Editor'da çalıştır.
-- event_participant_deposits: Katılımdan sonraki toplam yatırım miktarı

CREATE TABLE IF NOT EXISTS event_participant_deposits (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
    total_deposit_amount DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    currency_id VARCHAR(8) DEFAULT 'TRY',
    last_synced_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT uq_event_participant_deposit UNIQUE (event_id, participant_id)
);

CREATE INDEX IF NOT EXISTS ix_event_participant_deposits_event_id ON event_participant_deposits(event_id);
CREATE INDEX IF NOT EXISTS ix_event_participant_deposits_participant_id ON event_participant_deposits(participant_id);

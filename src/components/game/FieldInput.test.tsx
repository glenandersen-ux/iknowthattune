import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FieldInput } from './FieldInput';

describe('FieldInput', () => {
  it('renders a text field and reports changes', () => {
    const onChange = vi.fn();
    render(
      <FieldInput
        fieldId="song_title"
        type="text"
        label="Song Title"
        value=""
        onChange={onChange}
        locked={false}
      />,
    );
    const input = screen.getByLabelText('Song Title');
    fireEvent.change(input, { target: { value: 'Bohemian Rhapsody' } });
    expect(onChange).toHaveBeenCalledWith('Bohemian Rhapsody');
  });

  it('renders a year field with the tolerance band', () => {
    render(
      <FieldInput
        fieldId="release_year"
        type="year"
        label="Release Year"
        value=""
        onChange={vi.fn()}
        locked={false}
        tolerance={2}
      />,
    );
    expect(screen.getByText('(±2)')).toBeInTheDocument();
  });

  it('renders a choice field and toggles selection', () => {
    const onChange = vi.fn();
    render(
      <FieldInput
        fieldId="genre"
        type="choice"
        label="Genre"
        value={[]}
        onChange={onChange}
        locked={false}
      />,
    );
    fireEvent.click(screen.getByText('Rock'));
    expect(onChange).toHaveBeenCalledWith(['Rock']);
  });

  it('renders a multi field and adds an entry', () => {
    const onChange = vi.fn();
    render(
      <FieldInput
        fieldId="band_members"
        type="multi"
        label="Band Members"
        value={['Freddie Mercury']}
        onChange={onChange}
        locked={false}
      />,
    );
    const input = screen.getByLabelText('Band Members');
    fireEvent.change(input, { target: { value: 'Brian May' } });
    fireEvent.click(screen.getByText('+ Add'));
    expect(onChange).toHaveBeenCalledWith(['Freddie Mercury', 'Brian May']);
  });

  it('renders a locked field as a checked, read-only summary', () => {
    render(
      <FieldInput
        fieldId="song_title"
        type="text"
        label="Song Title"
        value="Bohemian Rhapsody"
        onChange={vi.fn()}
        locked
      />,
    );
    expect(screen.getByTestId('field-song_title-locked')).toBeInTheDocument();
    expect(screen.getByText('Bohemian Rhapsody')).toBeInTheDocument();
  });
});

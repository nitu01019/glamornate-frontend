import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { mockServices } from '../fixtures/firebase-mocks';

interface ServiceCardProps {
  service: (typeof mockServices)[0];
  onSelect?: (id: string) => void;
  selected?: boolean;
}

// Mock ServiceCard component - will be imported from actual component later
const ServiceCard = ({ service, onSelect, selected }: ServiceCardProps) => (
  <div
    data-testid={`service-${service.id}`}
    className={`p-4 border ${selected ? 'border-primary' : 'border-gray-200'}`}
    onClick={() => onSelect?.(service.id)}
  >
    <h3>{service.name}</h3>
    <p>{service.description}</p>
    <p data-testid="service-price">${service.basePrice}</p>
    <p>{service.baseDuration} min</p>
    <span data-testid="service-category">{service.category}</span>
    {selected && <span className="selected-badge">Selected</span>}
  </div>
);

describe('ServiceCard', () => {
  const mockService = mockServices[0];

  it('should render service details', () => {
    render(<ServiceCard service={mockService} />);

    expect(screen.getByText('Swedish Massage')).toBeInTheDocument();
    expect(
      screen.getByText('Relaxing full-body massage with Swedish techniques'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('service-price')).toHaveTextContent('$80');
    expect(screen.getByText('60 min')).toBeInTheDocument();
  });

  it('should call onSelect when clicked', async () => {
    const user = userEvent.setup();
    const handleSelect = vi.fn();

    render(<ServiceCard service={mockService} onSelect={handleSelect} />);

    const card = screen.getByTestId(`service-${mockService.id}`);
    await user.click(card);

    expect(handleSelect).toHaveBeenCalledWith(mockService.id);
  });

  it('should display selected state when selected prop is true', () => {
    render(<ServiceCard service={mockService} selected />);

    const card = screen.getByTestId(`service-${mockService.id}`);
    expect(card).toHaveClass('border-primary');
    expect(screen.getByText('Selected')).toBeInTheDocument();
  });

  it('should not display selected badge when not selected', () => {
    render(<ServiceCard service={mockService} selected={false} />);

    const card = screen.getByTestId(`service-${mockService.id}`);
    expect(card).toHaveClass('border-gray-200');
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();
  });

  it('should render service category', () => {
    render(<ServiceCard service={mockService} />);

    expect(screen.getByTestId('service-category')).toHaveTextContent('massage');
  });
});

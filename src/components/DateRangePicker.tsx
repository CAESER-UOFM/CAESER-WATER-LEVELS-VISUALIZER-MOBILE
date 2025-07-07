'use client';

import React, { useState, useRef, useEffect } from 'react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns';

interface DateRangePickerProps {
  startDate: Date;
  endDate: Date;
  onRangeChange: (start: Date, end: Date) => void;
  minDate?: Date;
  maxDate?: Date;
  disabled?: boolean;
  className?: string;
}

export function DateRangePicker({
  startDate,
  endDate,
  onRangeChange,
  minDate,
  maxDate,
  disabled = false,
  className = ''
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(startDate);
  const [selectedStart, setSelectedStart] = useState(startDate);
  const [selectedEnd, setSelectedEnd] = useState(endDate);
  const [selectingEnd, setSelectingEnd] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleDateClick = (date: Date) => {
    if (disabled) return;

    if (!selectingEnd) {
      setSelectedStart(date);
      setSelectedEnd(date);
      setSelectingEnd(true);
    } else {
      if (date < selectedStart) {
        setSelectedStart(date);
        setSelectedEnd(selectedStart);
      } else {
        setSelectedEnd(date);
      }
      setSelectingEnd(false);
    }
  };

  const handleApply = () => {
    onRangeChange(selectedStart, selectedEnd);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setSelectedStart(startDate);
    setSelectedEnd(endDate);
    setSelectingEnd(false);
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    
    // Get the first day of the week for the month
    const startDay = getDay(monthStart);
    const emptyDays = Array(startDay).fill(null);

    return (
      <div className="p-4">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={minDate && currentMonth <= minDate}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          
          <h3 className="text-lg font-semibold">
            {format(currentMonth, 'MMMM yyyy')}
          </h3>
          
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="p-1 hover:bg-gray-100 rounded"
            disabled={maxDate && currentMonth >= maxDate}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-2">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => (
            <div key={day} className="text-center text-xs font-medium text-gray-600 py-1">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar days */}
        <div className="grid grid-cols-7 gap-1">
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="p-2" />
          ))}
          
          {days.map(day => {
            const isSelected = (day >= selectedStart && day <= selectedEnd) || 
                             (day <= selectedStart && day >= selectedEnd);
            const isStart = isSameDay(day, selectedStart);
            const isEnd = isSameDay(day, selectedEnd);
            const isDisabled = (minDate && day < minDate) || (maxDate && day > maxDate);
            const isToday = isSameDay(day, new Date());

            return (
              <button
                key={day.toISOString()}
                onClick={() => handleDateClick(day)}
                disabled={isDisabled}
                className={`
                  p-2 text-sm rounded transition-colors
                  ${isSelected ? 'bg-blue-100' : ''}
                  ${isStart || isEnd ? 'bg-blue-500 text-white' : ''}
                  ${isToday && !isSelected ? 'border border-blue-500' : ''}
                  ${isDisabled ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100'}
                  ${!isDisabled && !isSelected ? 'cursor-pointer' : ''}
                `}
              >
                {format(day, 'd')}
              </button>
            );
          })}
        </div>

        {/* Selection info */}
        <div className="mt-4 p-3 bg-gray-50 rounded text-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-gray-600">Start:</span>
            <span className="font-medium">{format(selectedStart, 'MMM d, yyyy')}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-gray-600">End:</span>
            <span className="font-medium">{format(selectedEnd, 'MMM d, yyyy')}</span>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex justify-end space-x-2">
          <button
            onClick={handleCancel}
            className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
          >
            Apply
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          flex items-center space-x-2 px-4 py-2 bg-white border border-gray-300 rounded-lg
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-gray-400 cursor-pointer'}
        `}
      >
        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm">
          {format(startDate, 'MMM d, yyyy')} - {format(endDate, 'MMM d, yyyy')}
        </span>
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute top-full mt-2 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          {renderCalendar()}
        </div>
      )}
    </div>
  );
}
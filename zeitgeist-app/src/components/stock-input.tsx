"use client";

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Search, TrendingUp, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateStockTicker } from '@/lib/stock-utils';

// Popular stock symbols for auto-complete suggestions
import { POPULAR_STOCKS, resolveStockQuery } from '@/lib/stock-search';

interface StockInputProps {
  onSearch: (ticker: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showSuggestions?: boolean;
  autoFocus?: boolean;
  selectedTicker?: string;
}

interface ValidationState {
  isValid: boolean;
  error?: string;
  formattedValue: string;
}

export function StockInput({
  onSearch,
  isLoading = false,
  placeholder = "Enter stock symbol (e.g., AAPL, MSFT)",
  disabled = false,
  className,
  showSuggestions = true,
  autoFocus = false,
  selectedTicker = ""
}: StockInputProps) {
  const [inputValue, setInputValue] = useState('');
  const [validation, setValidation] = useState<ValidationState>({
    isValid: false,
    error: '',
    formattedValue: ''
  });
  const [showDropdown, setShowDropdown] = useState(false);
  // Derive suggestions from the displayed value, including values selected by mouse/keyboard.
  const query = inputValue.trim().toLowerCase();
  const filteredSuggestions = POPULAR_STOCKS.filter(stock =>
    !query || stock.symbol.toLowerCase().includes(query) || stock.name.toLowerCase().includes(query)
  );
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Validate input value
  const validateInput = useCallback((value: string) => {
    if (!value.trim()) {
      return {
        isValid: false,
        error: '',
        formattedValue: ''
      };
    }

    const result = validateStockTicker(resolveStockQuery(value));
    return {
      isValid: result.isValid,
      error: result.error,
      formattedValue: result.formattedTicker
    };
  }, []);

  useEffect(() => {
    setInputValue(selectedTicker);
    setValidation(validateInput(selectedTicker));
  }, [selectedTicker, validateInput]);

  // Handle input change
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    
    // Validate the input
    const validationResult = validateInput(value);
    setValidation(validationResult);

    setShowDropdown(showSuggestions);
    setHighlightedIndex(-1);
  }, [validateInput, showSuggestions]);

  // Handle search submission
  const handleSearch = useCallback(() => {
    if (validation.isValid && !isLoading && !disabled) {
      onSearch(validation.formattedValue);
      setShowDropdown(false);
    }
  }, [validation, isLoading, disabled, onSearch]);

  // Handle Enter key press
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (showDropdown && highlightedIndex >= 0 && filteredSuggestions[highlightedIndex]) {
        // Select highlighted suggestion
        const selectedStock = filteredSuggestions[highlightedIndex];
        onSearch(selectedStock.symbol);
        setInputValue(selectedStock.symbol);
        setValidation(validateInput(selectedStock.symbol));
        setShowDropdown(false);
        setHighlightedIndex(-1);
      } else {
        handleSearch();
      }
    } else if (e.key === 'ArrowDown' && showDropdown) {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredSuggestions.length - 1 ? prev + 1 : prev
      );
    } else if (e.key === 'ArrowUp' && showDropdown) {
      e.preventDefault();
      setHighlightedIndex(prev => prev > 0 ? prev - 1 : -1);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }, [showDropdown, highlightedIndex, filteredSuggestions, validateInput, handleSearch, onSearch]);

  // Handle suggestion selection
  const handleSuggestionClick = useCallback((stock: typeof POPULAR_STOCKS[0]) => {
    inputRef.current?.focus();
    setInputValue(stock.symbol);
    setValidation(validateInput(stock.symbol));
    setShowDropdown(false);
    setHighlightedIndex(-1);
  }, [validateInput]);

  // Handle input focus
  const handleFocus = useCallback(() => {
    if (showSuggestions) {
      setShowDropdown(true);
    }
  }, [showSuggestions]);

  // Close only when focus leaves the entire search widget; no stale blur timer.
  const handleBlur = useCallback((event: React.FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setShowDropdown(false);
      setHighlightedIndex(-1);
    }
  }, []);

  // Clear input
  const handleClear = useCallback(() => {
    setInputValue('');
    setValidation({ isValid: false, error: '', formattedValue: '' });
    setShowDropdown(false);
    setHighlightedIndex(-1);
    inputRef.current?.focus();
  }, []);

  // Auto-focus effect
  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  return (
    <div className={cn("relative w-full max-w-md", className)} onBlur={handleBlur}>
      {/* Input Container */}
      <div className="relative">
        <div
          className={cn(
            "relative flex items-center gap-1 w-full terminal-search rounded-xl border border-input p-1.5 text-sm",
            "transition-colors focus-within:border-[#0071e3] focus-within:ring-2 focus-within:ring-[#0071e3]/40",
            validation.error && inputValue && "border-destructive focus-within:border-destructive focus-within:ring-destructive/40",
            validation.isValid && "border-[#0071e3]",
            disabled && "cursor-not-allowed opacity-50"
          )}
        >
          {/* Search Icon */}
          <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" />

          {/* Input Field */}
          <input
            ref={inputRef}
            type="text"
            aria-label="Stock symbol"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={showSuggestions && showDropdown}
            aria-controls="stock-suggestions"
            aria-activedescendant={showDropdown && highlightedIndex >= 0 ? `stock-suggestion-${highlightedIndex}` : undefined}
            aria-invalid={Boolean(validation.error && inputValue)}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onFocus={handleFocus}
            placeholder={placeholder}
            disabled={disabled || isLoading}
            className={cn(
              "min-w-0 w-full flex-1 px-2 py-2.5 bg-transparent text-foreground placeholder:text-muted-foreground placeholder:normal-case placeholder:tracking-normal",
              "focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
              "text-sm font-medium tracking-wide uppercase"
            )}
            maxLength={80}
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />

          {/* Clear Button */}
          {inputValue && !isLoading && (
            <button
              onClick={handleClear}
              aria-label="Clear stock symbol"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
              disabled={disabled}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>
          )}

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!validation.isValid || isLoading || disabled}
          className={cn(
            "h-10 shrink-0 px-3 sm:px-5 rounded-xl",
            "bg-[#0071e3] text-white hover:bg-[#0077ed]",
            "disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed",
            "transition-all duration-200 ease-in-out",
            "flex items-center justify-center gap-2",
            "font-medium text-sm"
          )}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-xl border-2 border-current border-t-transparent" />
          ) : (
            <TrendingUp className="h-4 w-4" />
          )}
          {!isLoading && "Analyze"}
        </button>
        </div>
      </div>

      {/* Error Message */}
      {validation.error && inputValue && (
        <p className="mt-2 text-sm text-destructive">
          {validation.error}
        </p>
      )}

      {/* Auto-complete Dropdown */}
      {showSuggestions && showDropdown && (
        <div
          ref={dropdownRef}
          id="stock-suggestions"
          role="listbox"
          aria-label="Stock suggestions"
          className={cn(
            "absolute top-full mt-2 w-full bg-popover border border-border rounded-2xl shadow-lg z-50",
            "max-h-60 overflow-y-auto"
          )}
        >
          {filteredSuggestions.length > 0 ? (
            <div className="py-1">
              {filteredSuggestions.map((stock, index) => (
                <button
                  key={stock.symbol}
                  id={`stock-suggestion-${index}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onClick={() => handleSuggestionClick(stock)}
                  className={cn(
                    "w-full px-3 py-2 text-left hover:bg-accent hover:text-accent-foreground",
                    "focus:bg-accent focus:text-accent-foreground transition-colors",
                    index === highlightedIndex && "bg-accent text-accent-foreground"
                  )}
                  type="button"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{stock.symbol}</span>
                    <span className="text-xs text-muted-foreground truncate ml-2">
                      {stock.name}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="px-3 py-2 text-sm text-muted-foreground">
              No stocks found
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default StockInput;

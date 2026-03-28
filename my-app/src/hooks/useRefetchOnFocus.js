import { useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';

/**
 * Refetch when the screen gains focus (drawer tab / back navigation).
 * Pass stable extra deps if the fetch uses filters that can change while focused.
 */
export function useRefetchOnFocus(fetchFn, extraDeps = []) {
    const ref = useRef(fetchFn);
    ref.current = fetchFn;
    useFocusEffect(
        useCallback(() => {
            ref.current();
            // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchFn tracked via ref; extraDeps drive refocus/filter updates
        }, extraDeps),
    );
}
